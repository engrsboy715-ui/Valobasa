/*
# Partner Keys, admin profit ledger, and server-side task pricing

1. New Tables
- `partner_keys`: one row per Partner Key application. `status` is pending, approved or rejected. `code` is set once approved and is unique.
- `admin_profit_ledger`: every amount that enters the admin profit pool. `source` is `partner_key_fee` (৳250 per approved Partner Key) or `task_service_charge` (the admin share of each task's service charge).

2. Modified Tables
- `jobs`: new column `employer_is_partner` (boolean, default false) so task previews can show the PK badge.

3. Functions
- `apply_partner_key()`: signed-in user applies. Requires a balance of at least ৳250. Creates a pending application.
- `validate_partner_code(p_code)`: returns whether a code belongs to an approved partner, plus the partner's name.
- `admin_list_partner_keys()`: admin-only list of applications.
- `admin_review_partner_key(p_id, p_approve)`: admin-only. Approving deducts ৳250 from the applicant's balance, records it in the profit pool and generates a unique PK code. Rejecting only changes the status.
- `admin_profit_breakdown()`: admin-only totals per profit source.
- `create_task(p_input, p_partner_code)`: posts a task and computes the cost on the server.
  - No partner code: 25% service charge. The full charge goes to the admin profit pool.
  - Valid partner code: 20% service charge. 5% of the order subtotal is credited to the partner's balance. The remaining 15% goes to the admin profit pool.
  - An invalid code, or a user using their own code, is rejected.

4. Backfill
- Existing tasks' stored service charges are copied into the profit ledger so historical profit is preserved. This is idempotent.

5. Security
- Both new tables have RLS enabled.
- `partner_keys` is readable only by its owner (SELECT policy). All writes go through functions.
- `admin_profit_ledger` has no client grants or policies; it is only reachable through admin functions.
- Every new function is revoked from PUBLIC and anon and granted to authenticated only. Admin functions check `is_platform_admin()`.

6. Notes
- All statements are idempotent, so the migration can be safely re-run.
*/

CREATE TABLE IF NOT EXISTS partner_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  code text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_keys_one_open_per_user
  ON partner_keys (user_id) WHERE status IN ('pending', 'approved');

CREATE TABLE IF NOT EXISTS admin_profit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('partner_key_fee', 'task_service_charge')),
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  description text NOT NULL DEFAULT '',
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, reference_id)
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employer_is_partner boolean NOT NULL DEFAULT false;

ALTER TABLE partner_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profit_ledger ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON partner_keys TO authenticated;

DROP POLICY IF EXISTS "select_own_partner_key" ON partner_keys;
CREATE POLICY "select_own_partner_key" ON partner_keys FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.apply_partner_key()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.');
  END IF;

  SELECT balance INTO v_balance FROM profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found.');
  END IF;

  IF EXISTS (SELECT 1 FROM partner_keys WHERE user_id = v_uid AND status IN ('pending', 'approved')) THEN
    RETURN jsonb_build_object('success', false, 'message', 'You already have a Partner Key application.');
  END IF;

  IF v_balance < 250 THEN
    RETURN jsonb_build_object('success', false, 'message', 'A minimum balance of ৳250 is required to apply for a Partner Key.');
  END IF;

  INSERT INTO partner_keys (user_id) VALUES (v_uid);

  RETURN jsonb_build_object('success', true, 'message', 'Partner Key application submitted. An admin will review it shortly.');
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_partner_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_owner uuid;
  v_name text;
BEGIN
  IF v_code = '' THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Enter a partner code.');
  END IF;

  SELECT pk.user_id, p.full_name INTO v_owner, v_name
  FROM partner_keys pk
  JOIN profiles p ON p.id = pk.user_id
  WHERE pk.code = v_code AND pk.status = 'approved';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'message', 'That partner code is not valid.');
  END IF;

  IF v_owner = v_uid THEN
    RETURN jsonb_build_object('valid', false, 'message', 'You cannot use your own partner code.');
  END IF;

  RETURN jsonb_build_object('valid', true, 'message', 'Partner code applied.', 'partner_name', coalesce(v_name, 'Partner'));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_partner_keys()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  status text,
  code text,
  created_at timestamptz,
  reviewed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pk.id, pk.user_id, p.full_name, p.email, pk.status, pk.code, pk.created_at, pk.reviewed_at
  FROM partner_keys pk
  JOIN profiles p ON p.id = pk.user_id
  WHERE public.is_platform_admin()
  ORDER BY pk.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_partner_key(p_id uuid, p_approve boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pk partner_keys%ROWTYPE;
  v_balance numeric;
  v_code text;
  v_attempts integer := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized.');
  END IF;

  SELECT * INTO v_pk FROM partner_keys WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Application not found.');
  END IF;
  IF v_pk.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Application already reviewed.');
  END IF;

  IF NOT p_approve THEN
    UPDATE partner_keys SET status = 'rejected', reviewed_at = now() WHERE id = p_id;
    RETURN jsonb_build_object('success', true, 'message', 'Partner Key application rejected.');
  END IF;

  SELECT balance INTO v_balance FROM profiles WHERE id = v_pk.user_id FOR UPDATE;
  IF v_balance < 250 THEN
    RETURN jsonb_build_object('success', false, 'message', 'The applicant balance is below ৳250. Their application stays pending.');
  END IF;

  UPDATE profiles
  SET total_spend = total_spend + 250,
      balance = GREATEST(0, total_deposit + lifetime_earnings - total_withdraw - (total_spend + 250) - total_penalty)
  WHERE id = v_pk.user_id;

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (v_pk.user_id, 'spend', 250, 'Partner Key fee');

  INSERT INTO admin_profit_ledger (source, amount, description, reference_id)
  VALUES ('partner_key_fee', 250, 'Partner Key fee', p_id);

  LOOP
    v_code := 'PK' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM partner_keys WHERE code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate a unique partner code.';
    END IF;
  END LOOP;

  UPDATE partner_keys SET status = 'approved', code = v_code, reviewed_at = now() WHERE id = p_id;

  RETURN jsonb_build_object('success', true, 'message', 'Partner Key approved. Code: ' || v_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_profit_breakdown()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('task_service_charge', 0, 'partner_key_fee', 0);
  END IF;

  RETURN jsonb_build_object(
    'task_service_charge', COALESCE((SELECT sum(amount) FROM admin_profit_ledger WHERE source = 'task_service_charge'), 0),
    'partner_key_fee', COALESCE((SELECT sum(amount) FROM admin_profit_ledger WHERE source = 'partner_key_fee'), 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_task(p_input jsonb, p_partner_code text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text := NULLIF(upper(btrim(coalesce(p_partner_code, ''))), '');
  v_partner_uid uuid;
  v_subtotal numeric := (p_input->>'subtotal')::numeric;
  v_title text := coalesce(p_input->>'job_title', '');
  v_balance numeric;
  v_is_partner boolean;
  v_pct numeric;
  v_service numeric;
  v_total numeric;
  v_partner_share numeric := 0;
  v_admin_share numeric;
  v_job_id uuid := gen_random_uuid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.');
  END IF;
  IF v_subtotal IS NULL OR v_subtotal <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid task amount.');
  END IF;

  IF v_code IS NOT NULL THEN
    SELECT user_id INTO v_partner_uid FROM partner_keys WHERE code = v_code AND status = 'approved';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'That partner code is not valid.');
    END IF;
    IF v_partner_uid = v_uid THEN
      RETURN jsonb_build_object('success', false, 'message', 'You cannot use your own partner code.');
    END IF;
  END IF;

  SELECT balance INTO v_balance FROM profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Profile not found.');
  END IF;

  IF v_partner_uid IS NOT NULL THEN
    v_pct := 20;
    v_partner_share := round(v_subtotal * 0.05, 2);
  ELSE
    v_pct := 25;
  END IF;
  v_service := round(v_subtotal * v_pct / 100, 2);
  v_admin_share := v_service - v_partner_share;
  v_total := v_subtotal + v_service;

  IF v_balance < v_total THEN
    RETURN jsonb_build_object('success', false, 'message', 'Your balance is too low for this task.');
  END IF;

  v_is_partner := EXISTS (SELECT 1 FROM partner_keys WHERE user_id = v_uid AND status = 'approved');

  INSERT INTO jobs (
    id, user_id, work_id, platform, sub_task_type, job_title, rate, total_workers, available_slots,
    level, employer_name, page_name, reference_screenshot, page_link, comment_lines, instructions,
    status, subtotal, service_charge, total_cost, employer_is_partner
  ) VALUES (
    v_job_id, v_uid,
    p_input->>'work_id', p_input->>'platform', p_input->>'sub_task_type', v_title,
    (p_input->>'rate')::numeric, (p_input->>'total_workers')::integer, (p_input->>'total_workers')::integer,
    p_input->>'level', p_input->>'employer_name', p_input->>'page_name', p_input->>'reference_screenshot',
    NULLIF(p_input->>'page_link', ''),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_input->'comment_lines', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(coalesce(p_input->'instructions', '[]'::jsonb))),
    'Active', v_subtotal, v_service, v_total, v_is_partner
  );

  UPDATE profiles
  SET total_spend = total_spend + v_total,
      balance = GREATEST(0, total_deposit + lifetime_earnings - total_withdraw - (total_spend + v_total) - total_penalty)
  WHERE id = v_uid;

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (v_uid, 'spend', v_total, 'Created task: ' || v_title);

  IF v_partner_uid IS NOT NULL THEN
    UPDATE profiles
    SET lifetime_earnings = lifetime_earnings + v_partner_share,
        balance = GREATEST(0, total_deposit + lifetime_earnings + v_partner_share - total_withdraw - total_spend - total_penalty)
    WHERE id = v_partner_uid;

    INSERT INTO transactions (user_id, type, amount, description)
    VALUES (v_partner_uid, 'reward', v_partner_share, 'Partner commission: ' || v_title);
  END IF;

  INSERT INTO admin_profit_ledger (source, amount, description, reference_id)
  VALUES ('task_service_charge', v_admin_share, 'Service charge: ' || v_title, v_job_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Task created! ৳' || to_char(v_total, 'FM999999990.00') || ' deducted. It''s now live in Work.',
    'job_id', v_job_id,
    'total_cost', v_total
  );
END;
$$;

INSERT INTO admin_profit_ledger (source, amount, description, reference_id)
SELECT 'task_service_charge', j.service_charge, 'Service charge: ' || j.job_title, j.id
FROM jobs j
WHERE j.service_charge > 0
ON CONFLICT (source, reference_id) DO NOTHING;

REVOKE EXECUTE ON FUNCTION public.apply_partner_key() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_partner_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_partner_keys() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_partner_key(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_profit_breakdown() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_task(jsonb, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.apply_partner_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_partner_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_partner_keys() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_partner_key(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_profit_breakdown() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_task(jsonb, text) TO authenticated;
