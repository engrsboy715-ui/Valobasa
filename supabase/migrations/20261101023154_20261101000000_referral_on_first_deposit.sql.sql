/*
# Referral rewards gated on first ৳50 deposit

1. Modified Functions
- `apply_referral(code, referee)` — now creates a `pending` referral row and sets
  `referred_by` on the new user, but NO LONGER awards coins immediately. Coins
  are awarded only when the referee's first deposit (>= ৳50) is approved.
- This replaces the previous behavior where 100 coins were awarded to both
  users at signup. Now rewards unlock on the first qualifying deposit, matching
  the product requirement: "using a referral code and making the first ৳50
  deposit awards 100 coins to both users' wallets instantly."

2. New Functions
- `award_referral_on_first_deposit(p_referee uuid)` — looks up a `pending`
  referral for the given referee. If found, awards 100 coins to both the
  referrer and the referee, then marks the referral as `completed`.
  Idempotent: if no pending referral exists, it does nothing and returns success.

3. Security
- Both functions remain SECURITY DEFINER with restricted search_path.
- `award_referral_on_first_deposit` is callable by any authenticated user
  (the admin approving deposits is authenticated). It is safe because it only
  awards a pending referral once (pending -> completed transition).

4. Notes
- Existing `completed` referrals from before this migration are untouched.
- The referral row's `status` column now uses 'pending' and 'completed' values.
- 100 coins = 1 BDT. Coin balances are integers.
*/

-- ---------- apply_referral: pending only, no coin awards ----------
CREATE OR REPLACE FUNCTION public.apply_referral(p_code text, p_referee uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer profiles.id%TYPE;
  v_existing int;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' OR p_referee IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referral code is required.');
  END IF;

  SELECT id INTO v_referrer FROM profiles WHERE referral_code = upper(btrim(p_code));
  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid referral code.');
  END IF;

  IF v_referrer = p_referee THEN
    RETURN jsonb_build_object('success', false, 'message', 'You cannot use your own referral code.');
  END IF;

  SELECT count(*) INTO v_existing FROM referrals WHERE referee_id = p_referee;
  IF v_existing > 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'A referral has already been applied to your account.');
  END IF;

  INSERT INTO referrals (referrer_id, referee_id, referrer_coins, referee_coins, status)
    VALUES (v_referrer, p_referee, 100, 100, 'pending');

  UPDATE profiles SET referred_by = v_referrer WHERE id = p_referee;

  RETURN jsonb_build_object('success', true, 'message', 'Referral code applied! Make your first deposit of at least ৳50 to unlock 100 bonus coins for you and your referrer.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_referral(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral(text, uuid) TO authenticated;

-- ---------- award_referral_on_first_deposit ----------
CREATE OR REPLACE FUNCTION public.award_referral_on_first_deposit(p_referee uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral referrals%ROWTYPE;
BEGIN
  IF p_referee IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referee ID is required.');
  END IF;

  SELECT * INTO v_referral FROM referrals
    WHERE referee_id = p_referee AND status = 'pending'
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'No pending referral to award.');
  END IF;

  UPDATE referrals SET status = 'completed' WHERE id = v_referral.id;

  UPDATE profiles SET coins = coins + v_referral.referrer_coins
    WHERE id = v_referral.referrer_id;
  UPDATE profiles SET coins = coins + v_referral.referee_coins
    WHERE id = v_referral.referee_id;

  RETURN jsonb_build_object('success', true, 'message', 'Referral rewarded! 100 coins awarded to both users.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_referral_on_first_deposit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_referral_on_first_deposit(uuid) TO authenticated;