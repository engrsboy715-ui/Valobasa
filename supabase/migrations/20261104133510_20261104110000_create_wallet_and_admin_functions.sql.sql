/*
# Server-side functions for balance mutations and admin deposit approval

## Problem
The `balance`, `coins`, `lifetime_earnings`, `total_deposit`, `total_withdraw`,
`total_spend`, `total_penalty` columns on profiles are NOT client-updatable
(column-level grant restricts UPDATE to full_name and email only).
Deposits, withdrawals, and proof approvals need to modify these columns.

## Solution
1. Add wallet columns to profiles if missing (lifetime_earnings, total_deposit,
   total_withdraw, total_spend, total_penalty).
2. `add_transaction(p_type, p_amount, p_description)` — a SECURITY DEFINER
   function that atomically:
   - Inserts a row into `transactions`
   - Updates the user's profile balance/coins/totals based on transaction type
   This is the single entry point for all wallet mutations.
3. `approve_deposit(p_deposit_id)` — admin-only, approves a deposit and credits
   the user's balance via add_transaction logic.
4. `reject_deposit(p_deposit_id)` — admin-only, marks deposit rejected.
5. `approve_withdrawal(p_withdrawal_id)` — admin-only, marks withdrawal approved.
6. `reject_withdrawal(p_withdrawal_id)` — admin-only, refunds the user.
7. `approve_proof(p_proof_id)` — job owner only, approves a proof and pays the worker.
8. `reject_proof(p_proof_id, p_reason)` — job owner only, rejects a proof.

## Security
- All functions are SECURITY DEFINER with search_path = public.
- add_transaction is callable by authenticated for their own user_id only.
- Admin functions (approve/reject deposit, approve/reject withdrawal) are gated
  on is_platform_admin().
- Proof approve/reject gated on job ownership.
- EXECUTE revoked from PUBLIC/anon on all functions.
*/

-- ========== 1. Add wallet columns to profiles ==========
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lifetime_earnings numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_deposit numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdraw numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spend numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_penalty numeric NOT NULL DEFAULT 0;

-- Update the fetchProfile SELECT — we don't need to change the function,
-- just ensure the columns exist. The frontend will select them.

-- ========== 2. add_transaction ==========
CREATE OR REPLACE FUNCTION public.add_transaction(
  p_type text,
  p_amount numeric,
  p_description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_coins integer;
  v_lifetime numeric;
  v_deposit numeric;
  v_withdraw numeric;
  v_spend numeric;
  v_penalty numeric;
  v_balance numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated.');
  END IF;

  SELECT coins, lifetime_earnings, total_deposit, total_withdraw, total_spend, total_penalty
    INTO v_coins, v_lifetime, v_deposit, v_withdraw, v_spend, v_penalty
    FROM profiles WHERE id = v_uid;

  IF p_type = 'reward' THEN
    v_lifetime := v_lifetime + p_amount;
    v_coins := v_coins + ROUND(p_amount * 10);
  ELSIF p_type = 'deposit' THEN
    v_deposit := v_deposit + p_amount;
  ELSIF p_type = 'withdraw' THEN
    v_withdraw := v_withdraw + p_amount;
  ELSIF p_type = 'spend' THEN
    v_spend := v_spend + p_amount;
  ELSIF p_type = 'penalty' THEN
    v_penalty := v_penalty + p_amount;
  ELSIF p_type = 'deposit_rejected' THEN
    -- no balance change, just records the event
    NULL;
  END IF;

  v_balance := GREATEST(0, v_deposit + v_lifetime - v_withdraw - v_spend - v_penalty);

  INSERT INTO transactions (user_id, type, amount, description)
    VALUES (v_uid, p_type, p_amount, p_description);

  UPDATE profiles
    SET coins = v_coins, lifetime_earnings = v_lifetime,
        total_deposit = v_deposit, total_withdraw = v_withdraw,
        total_spend = v_spend, total_penalty = v_penalty,
        balance = v_balance
    WHERE id = v_uid;

  RETURN jsonb_build_object('success', true, 'message', 'Transaction recorded.', 'balance', v_balance);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_transaction(text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_transaction(text, numeric, text) TO authenticated;

-- ========== 3. approve_deposit (admin) ==========
CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit deposits%ROWTYPE;
  v_uid uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized.');
  END IF;

  SELECT * INTO v_deposit FROM deposits WHERE id = p_deposit_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Deposit not found.');
  END IF;
  IF v_deposit.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Deposit already processed.');
  END IF;

  UPDATE deposits SET status = 'approved' WHERE id = p_deposit_id;

  -- Credit the user's balance using add_transaction logic inline (since add_transaction uses auth.uid())
  -- We need to act as the deposit owner, so we do it manually:
  INSERT INTO transactions (user_id, type, amount, description)
    VALUES (v_deposit.user_id, 'deposit', v_deposit.amount,
            'Deposit approved: ' || v_deposit.method);

  UPDATE profiles
    SET total_deposit = total_deposit + v_deposit.amount,
        balance = GREATEST(0, total_deposit + lifetime_earnings - total_withdraw - total_spend - total_penalty)
    WHERE id = v_deposit.user_id;

  -- Award referral on first deposit
  PERFORM public.award_referral_on_first_deposit(v_deposit.user_id);

  RETURN jsonb_build_object('success', true, 'message', 'Deposit approved and balance credited.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_deposit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_deposit(uuid) TO authenticated;

-- ========== 4. reject_deposit (admin) ==========
CREATE OR REPLACE FUNCTION public.reject_deposit(p_deposit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deposit deposits%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized.');
  END IF;

  SELECT * INTO v_deposit FROM deposits WHERE id = p_deposit_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Deposit not found.');
  END IF;
  IF v_deposit.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Deposit already processed.');
  END IF;

  UPDATE deposits SET status = 'rejected' WHERE id = p_deposit_id;

  INSERT INTO transactions (user_id, type, amount, description)
    VALUES (v_deposit.user_id, 'deposit_rejected', v_deposit.amount,
            'Deposit rejected: ' || v_deposit.method);

  RETURN jsonb_build_object('success', true, 'message', 'Deposit rejected.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_deposit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_deposit(uuid) TO authenticated;

-- ========== 5. approve_withdrawal (admin) ==========
CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wd withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized.');
  END IF;

  SELECT * INTO v_wd FROM withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Withdrawal not found.');
  END IF;
  IF v_wd.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Withdrawal already processed.');
  END IF;

  UPDATE withdrawals SET status = 'approved' WHERE id = p_withdrawal_id;

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal approved.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;

-- ========== 6. reject_withdrawal (admin — refunds user) ==========
CREATE OR REPLACE FUNCTION public.reject_withdrawal(p_withdrawal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wd withdrawals%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized.');
  END IF;

  SELECT * INTO v_wd FROM withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Withdrawal not found.');
  END IF;
  IF v_wd.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Withdrawal already processed.');
  END IF;

  UPDATE withdrawals SET status = 'rejected' WHERE id = p_withdrawal_id;

  -- Refund the total_deducted amount back to user
  INSERT INTO transactions (user_id, type, amount, description)
    VALUES (v_wd.user_id, 'deposit', v_wd.total_deducted,
            'Withdrawal rejected: refunded');

  UPDATE profiles
    SET total_deposit = total_deposit + v_wd.total_deducted,
        balance = GREATEST(0, total_deposit + lifetime_earnings - total_withdraw - total_spend - total_penalty)
    WHERE id = v_wd.user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected and amount refunded.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid) TO authenticated;

-- ========== 7. approve_proof (job owner) ==========
CREATE OR REPLACE FUNCTION public.approve_proof(p_proof_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Only the job owner can approve
  IF v_job.user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the job owner can approve proofs.');
  END IF;

  UPDATE proofs SET status = 'Approved', reviewed_at = now() WHERE id = p_proof_id;

  -- Pay the worker
  INSERT INTO transactions (user_id, type, amount, description)
    VALUES (v_proof.worker_id, 'reward', v_proof.reward,
            'Proof approved: ' || v_proof.work_id);

  UPDATE profiles
    SET lifetime_earnings = lifetime_earnings + v_proof.reward,
        coins = coins + ROUND(v_proof.reward * 10),
        balance = GREATEST(0, total_deposit + lifetime_earnings + v_proof.reward - total_withdraw - total_spend - total_penalty)
    WHERE id = v_proof.worker_id;

  -- Update job status
  UPDATE jobs
    SET status = CASE WHEN available_slots <= 0 THEN 'Completed' ELSE 'Active' END
    WHERE id = v_job.id;

  RETURN jsonb_build_object('success', true, 'message', 'Proof approved and worker paid.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_proof(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_proof(uuid) TO authenticated;

-- ========== 8. reject_proof (job owner) ==========
CREATE OR REPLACE FUNCTION public.reject_proof(p_proof_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_job.user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Only the job owner can reject proofs.');
  END IF;

  UPDATE proofs SET status = 'Rejected', reviewed_at = now(), rejection_reason = p_reason
    WHERE id = p_proof_id;

  -- Free up the slot
  UPDATE jobs SET status = 'Active', available_slots = available_slots + 1
    WHERE id = v_job.id;

  RETURN jsonb_build_object('success', true, 'message', 'Proof rejected.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_proof(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_proof(uuid, text) TO authenticated;

-- ========== 9. Admin list functions ==========
CREATE OR REPLACE FUNCTION public.admin_list_deposits()
RETURNS TABLE (
  id uuid, user_id uuid, user_name text, amount numeric, method text,
  sender_number text, trx_id text, status text, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, user_id, user_name, amount, method, sender_number, trx_id, status, created_at
  FROM deposits WHERE public.is_platform_admin() ORDER BY created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_deposits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_deposits() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_withdrawals()
RETURNS TABLE (
  id uuid, user_id uuid, user_name text, amount numeric, service_charge numeric,
  total_deducted numeric, method text, receiver_number text, status text, created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, user_id, user_name, amount, service_charge, total_deducted, method, receiver_number, status, created_at
  FROM withdrawals WHERE public.is_platform_admin() ORDER BY created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_withdrawals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_withdrawals() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_all_proofs()
RETURNS SETOF proofs
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM proofs WHERE public.is_platform_admin() ORDER BY submitted_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_all_proofs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_all_proofs() TO authenticated;
