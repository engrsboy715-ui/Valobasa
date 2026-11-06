/*
# Reserve a job slot when a worker submits, and block repeat submissions

1. Problem
- Submitting a proof never reduced the job's remaining slots, so every task always showed its full slot count.
- Nothing stopped the same worker from submitting the same task again.

2. Changes
- New function `reserve_job_slot_on_submit()` runs before each new proof is saved. It:
  - Rejects the submission if this worker already submitted this task.
  - Rejects the submission if the task is not active, is locked, is the worker's own task, or has no slots left.
  - Takes one slot from the task. When the last slot is taken, the task status becomes Completed.
- New trigger `proofs_reserve_job_slot` on proofs that calls the function.
- The `jobs` table is added to the realtime publication so the work feed can refresh slot counts live.

3. Security
- The function is SECURITY DEFINER with a fixed search_path so it can update slots regardless of the worker's row access.
- EXECUTE is revoked from PUBLIC, anon and authenticated; only the trigger runs it.
- Existing policies are unchanged.

4. Notes
- A rejected proof still returns its slot through the existing reject flow. The worker remains blocked from resubmitting that task.
- Existing proofs are not modified. An advisory lock prevents two simultaneous submissions from the same worker for the same task from both succeeding.
*/

CREATE OR REPLACE FUNCTION public.reserve_job_slot_on_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.job_id::text || ':' || NEW.worker_id::text));

  IF EXISTS (
    SELECT 1 FROM proofs WHERE job_id = NEW.job_id AND worker_id = NEW.worker_id
  ) THEN
    RAISE EXCEPTION 'You have already submitted this task.' USING ERRCODE = 'unique_violation';
  END IF;

  UPDATE jobs
  SET available_slots = available_slots - 1,
      status = CASE WHEN available_slots - 1 <= 0 THEN 'Completed' ELSE status END
  WHERE id = NEW.job_id
    AND status = 'Active'
    AND locked = false
    AND available_slots > 0
    AND user_id <> NEW.worker_id
  RETURNING * INTO v_job;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This task is no longer available.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_job_slot_on_submit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS proofs_reserve_job_slot ON public.proofs;
CREATE TRIGGER proofs_reserve_job_slot
BEFORE INSERT ON public.proofs
FOR EACH ROW EXECUTE FUNCTION public.reserve_job_slot_on_submit();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'jobs'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
  END IF;
END $$;
