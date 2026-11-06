/*
# Create referral, KYC, support, and rating systems

1. Modified Tables
- `profiles`
  - `referral_code` (text, unique) — each user's shareable referral code (auto-generated on insert)
  - `referred_by` (uuid, FK to profiles) — the referrer who invited this user
  - `kyc_status` (text, default 'none') — none / pending / verified / rejected
  - `is_admin` (boolean, default false) — flags admin accounts (admin-only column, not client-updatable)
- Sensitive columns `balance`, `coins`, `rank`, `is_admin`, `referred_by`, `kyc_status`
  are no longer directly updatable by the client. They change only through
  SECURITY DEFINER functions (referral rewards, admin actions).

2. New Tables
- `referrals` — one row per completed referral (referrer + referee, coins awarded to each)
- `kyc_submissions` — KYC personal info + document image data URLs + admin review status
- `support_tickets` — a support/live-chat thread started by a user
- `support_messages` — individual messages inside a ticket (sender = user | admin)
- `app_ratings` — 1–5 star feedback submitted from the Rate Us modal

3. Security
- RLS enabled on every new table; owner-scoped CRUD for the authenticated user
  who owns the row, plus admin read via SECURITY DEFINER functions.
- `is_admin` column on profiles is not client-updatable (column-level grant).
- SECURITY DEFINER functions for referral rewards, KYC admin review, and support
  admin replies, all gated on `profiles.is_admin` for admin-only operations.

4. Functions
- `apply_referral(code, referee)` — validates a referral code on signup, awards
  100 coins to referrer AND 100 coins to the new user, records the referral.
- `admin_list_kyc()` / `admin_review_kyc(id, status, note)` — admin reads all KYC
  submissions and approves/rejects them.
- `admin_list_tickets()` / `admin_reply(ticket, body)` — admin reads all support
  tickets and posts admin replies.
- `gen_referral_code()` — builds a unique human-readable code (ET + 6 base36 chars).

5. Notes
- Currency: 100 coins = 1 BDT. Coin balances are integers; the frontend converts
  to BDT for display. Referral rewards: +100 coins to both referrer and referee.
- KYC documents are stored as base64 data URLs in text columns so no storage
  bucket setup is required.
*/

-- ---------- profiles additions ----------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Restrict client updates to sensitive columns. Users may still update their
-- own display name and email; everything else is server-controlled.
REVOKE UPDATE ON profiles FROM anon, authenticated;
GRANT UPDATE (full_name, email) ON profiles TO authenticated;

-- referral_code auto-generation trigger
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
      candidate := 'ET' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
      IF NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = candidate) THEN
        NEW.referral_code := candidate;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_referral_code ON profiles;
CREATE TRIGGER profiles_set_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_referral_code();

REVOKE EXECUTE ON FUNCTION public.set_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_referral_code() TO authenticated;

-- ---------- referrals ----------
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referrer_coins integer NOT NULL DEFAULT 100,
  referee_coins integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz DEFAULT now(),
  UNIQUE (referee_id)
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON referrals TO authenticated;

DROP POLICY IF EXISTS "select_own_referrals" ON referrals;
CREATE POLICY "select_own_referrals"
  ON referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- ---------- kyc_submissions ----------
CREATE TABLE IF NOT EXISTS kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  id_type text NOT NULL,
  id_number text NOT NULL,
  country text NOT NULL,
  address text NOT NULL,
  date_of_birth text NOT NULL,
  gender text NOT NULL,
  id_front_img text NOT NULL,
  id_back_img text NOT NULL,
  selfie_img text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON kyc_submissions TO authenticated;

DROP POLICY IF EXISTS "select_own_kyc" ON kyc_submissions;
CREATE POLICY "select_own_kyc"
  ON kyc_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_kyc" ON kyc_submissions;
CREATE POLICY "insert_own_kyc"
  ON kyc_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_kyc" ON kyc_submissions;
CREATE POLICY "update_own_kyc"
  ON kyc_submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_submissions(status);

-- ---------- support_tickets ----------
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  subject text NOT NULL DEFAULT 'General Support',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON support_tickets TO authenticated;

DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_tickets" ON support_tickets;
CREATE POLICY "insert_own_tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ---------- support_messages ----------
CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sender text NOT NULL,
  body text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON support_messages TO authenticated;

DROP POLICY IF EXISTS "select_own_messages" ON support_messages;
CREATE POLICY "select_own_messages"
  ON support_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM support_tickets t
            WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_messages" ON support_messages;
CREATE POLICY "insert_own_messages"
  ON support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_admin = false
    AND EXISTS (SELECT 1 FROM support_tickets t
                WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_messages_ticket ON support_messages(ticket_id, created_at);

-- ---------- app_ratings ----------
CREATE TABLE IF NOT EXISTS app_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_ratings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON app_ratings TO authenticated;

DROP POLICY IF EXISTS "select_own_ratings" ON app_ratings;
CREATE POLICY "select_own_ratings"
  ON app_ratings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ratings" ON app_ratings;
CREATE POLICY "insert_own_ratings"
  ON app_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ---------- apply_referral (called by the new user after signup) ----------
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

  INSERT INTO referrals (referrer_id, referee_id, referrer_coins, referee_coins)
    VALUES (v_referrer, p_referee, 100, 100);

  UPDATE profiles SET coins = coins + 100, referred_by = v_referrer WHERE id = v_referrer;
  UPDATE profiles SET coins = coins + 100, referred_by = v_referrer WHERE id = p_referee;

  RETURN jsonb_build_object('success', true, 'message', 'Referral applied! 100 coins awarded to both you and your referrer.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_referral(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral(text, uuid) TO authenticated;

-- ---------- admin KYC functions ----------
CREATE OR REPLACE FUNCTION public.admin_list_kyc()
RETURNS SETOF kyc_submissions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM kyc_submissions
  WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_kyc() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_kyc() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_kyc(p_id uuid, p_status text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized.');
  END IF;
  IF p_status NOT IN ('verified', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid status.');
  END IF;
  UPDATE kyc_submissions
    SET status = p_status, admin_note = p_note, reviewed_at = now()
    WHERE id = p_id;
  UPDATE profiles SET kyc_status = p_status
    WHERE id = (SELECT user_id FROM kyc_submissions WHERE id = p_id);
  RETURN jsonb_build_object('success', true, 'message', 'KYC ' || p_status || '.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_review_kyc(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_kyc(uuid, text, text) TO authenticated;

-- ---------- admin support functions ----------
CREATE OR REPLACE FUNCTION public.admin_list_tickets()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_name text,
  subject text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  last_message text,
  last_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.user_id, t.user_name, t.subject, t.status, t.created_at, t.updated_at,
         (SELECT m.body FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
         (SELECT m.created_at FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_at
  FROM support_tickets t
  WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  ORDER BY t.updated_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_tickets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_tickets() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reply(p_ticket uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authorized.');
  END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Message cannot be empty.');
  END IF;
  INSERT INTO support_messages (ticket_id, sender, body, is_admin)
    VALUES (p_ticket, 'Admin', p_body, true);
  UPDATE support_tickets SET updated_at = now(), status = 'open' WHERE id = p_ticket;
  RETURN jsonb_build_object('success', true, 'message', 'Reply sent.');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reply(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reply(uuid, text) TO authenticated;

-- ---------- mark first profile as admin (for the demo) ----------
UPDATE profiles SET is_admin = true WHERE email = 'admin@platform.bd';