/*
# Task approval pays cash only

1. Problem
- Approving a worker's task proof credited the worker both cash and coins (10 coins per taka).
- Coins should only come from the referral system.

2. Changes
- `approve_proof(p_proof_id)` now credits the reward to the worker's balance and lifetime earnings only.
- The coin credit is removed. Everything else is unchanged: the proof is marked Approved, a reward
  transaction is recorded, the job status is updated, and only the job owner or an admin may approve.

3. Security
- The function keeps its SECURITY DEFINER setting, fixed search_path and existing EXECUTE grants.

4. Notes
- Referral coin rewards are not touched.
- Coins already credited by past task approvals are not reversed.
*/

CREATE OR REPLACE FUNCTION public.approve_proof(p_proof_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_proof proofs%ROWTYPE;
  v_job jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_proof FROM proofs WHERE id = p_proof_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Proof not found.');
  END IF;
  IF v_proof.status <> 'Pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Proof already reviewed.');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_proof.job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Job not found.');
  END IF;

  IF v_job.user_id <> auth.uid() AND NOT is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the job owner or an admin can approve proofs.');
  END IF;

  UPDATE proofs SET status = 'Approved', reviewed_at = now() WHERE id = p_proof_id;

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (v_proof.worker_id, 'reward', v_proof.reward, 'Proof approved: ' || v_proof.work_id);

  UPDATE profiles
  SET lifetime_earnings = lifetime_earnings + v_proof.reward,
      balance = GREATEST(0, total_deposit + lifetime_earnings + v_proof.reward - total_withdraw - total_spend - total_penalty)
  WHERE id = v_proof.worker_id;

  UPDATE jobs
  SET status = CASE WHEN available_slots <= 0 THEN 'Completed' ELSE 'Active' END
  WHERE id = v_job.id;

  RETURN jsonb_build_object('success', true, 'message', 'Proof approved and worker paid.');
END;
$function$;
