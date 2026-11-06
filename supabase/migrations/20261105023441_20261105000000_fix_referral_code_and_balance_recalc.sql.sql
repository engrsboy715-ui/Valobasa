/*
# Fix referral code generation and balance recalculation

## Plain-English summary
New accounts were failing to save because the referral code generator called a
random-number function that is not available in this database. This migration
switches it to a built-in generator, so every new user gets a unique referral
code and the signup save succeeds.

It also fixes deposit approval and withdrawal rejection, which calculated the
user's balance from values before the update, leaving the balance one step behind.

## Changed functions
1. set_referral_code() - uses gen_random_uuid() (built in) instead of gen_random_bytes().
2. approve_deposit() - updates totals first, then recalculates balance from the new totals.
3. reject_withdrawal() - same two-step recalculation.

## Security
No table or policy changes. Functions keep SECURITY DEFINER with search_path = public
and their existing EXECUTE grants.

## Notes
- The referral code format stays "ET" + 6 uppercase hex characters and is checked for uniqueness in a loop.
- Idempotent: CREATE OR REPLACE only.
*/

CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      candidate := 'ET' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      IF NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = candidate) THEN
        NEW.referral_code := candidate;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
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

  UPDATE deposits SET status = 'approved' WHERE id = p_deposit_id;

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (v_deposit.user_id, 'deposit', v_deposit.amount,
          'Deposit approved: ' || v_deposit.method);

  UPDATE profiles
  SET total_deposit = total_deposit + v_deposit.amount
  WHERE id = v_deposit.user_id;

  UPDATE profiles
  SET balance = GREATEST(0, total_deposit + lifetime_earnings - total_withdraw - total_spend - total_penalty)
  WHERE id = v_deposit.user_id;

  PERFORM public.award_referral_on_first_deposit(v_deposit.user_id);

  RETURN jsonb_build_object('success', true, 'message', 'Deposit approved and balance credited.');
END;
$$;

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

  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (v_wd.user_id, 'deposit', v_wd.total_deducted, 'Withdrawal rejected: refunded');

  UPDATE profiles
  SET total_deposit = total_deposit + v_wd.total_deducted
  WHERE id = v_wd.user_id;

  UPDATE profiles
  SET balance = GREATEST(0, total_deposit + lifetime_earnings - total_withdraw - total_spend - total_penalty)
  WHERE id = v_wd.user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected and amount refunded.');
END;
$$;
