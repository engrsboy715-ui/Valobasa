/*
# Admin email-based authorization + referral code backfill

## Problem 1: Admin DB functions check `is_admin = true` in profiles, but the
frontend now gates admin access by email (`mdesrafil2510@gmail.com`). The
original seed set `is_admin = true` only for `admin@platform.bd`, so the real
admin's RPCs all return "Not authorized."

## Fix 1: Replace every `is_admin = true` check inside admin SECURITY DEFINER
functions with `email = 'mdesrafil2510@gmail.com'`. Also set `is_admin = true`
for that email so both checks agree. This covers:
  - admin_list_kyc()
  - admin_review_kyc(id, status, note)
  - admin_list_tickets()
  - admin_reply(ticket, body)
  - admin_fetch_ticket_messages(ticket)  — previously had NO admin check at all

## Problem 2: The `set_referral_code()` trigger fires only on INSERT. Existing
users whose rows were created before the trigger (or via a path that didn't
fire it) have NULL referral_code and will never get one.

## Fix 2: Backfill NULL referral_code values using the same generation logic
as the trigger. Each code is `ET` + 6 hex chars, checked for uniqueness.

## Security
- All admin functions remain SECURITY DEFINER with search_path = public.
- EXECUTE remains revoked from PUBLIC/anon, granted only to authenticated.
- The admin email is hardcoded in the function bodies (not user-editable).
*/

-- ---------- 1. Set is_admin for the real admin email ----------
UPDATE profiles SET is_admin = true WHERE lower(email) = 'mdesrafil2510@gmail.com';

-- ---------- 2. Referral code backfill for existing users ----------
DO $$
DECLARE
  r RECORD;
  candidate text;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE referral_code IS NULL LOOP
    LOOP
      candidate := 'ET' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
      IF NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = candidate) THEN
        UPDATE profiles SET referral_code = candidate WHERE id = r.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ---------- 3. Admin helper: email-based check ----------
-- A small helper function so all admin RPCs share one authorization check.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND lower(email) = 'mdesrafil2510@gmail.com'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ---------- 4. Rewrite admin_list_kyc ----------
CREATE OR REPLACE FUNCTION public.admin_list_kyc()
RETURNS SETOF kyc_submissions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM kyc_submissions
  WHERE public.is_platform_admin()
  ORDER BY created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_kyc() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_kyc() TO authenticated;

-- ---------- 5. Rewrite admin_review_kyc ----------
CREATE OR REPLACE FUNCTION public.admin_review_kyc(p_id uuid, p_status text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
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

-- ---------- 6. Rewrite admin_list_tickets ----------
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
  WHERE public.is_platform_admin()
  ORDER BY t.updated_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_tickets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_tickets() TO authenticated;

-- ---------- 7. Rewrite admin_reply ----------
CREATE OR REPLACE FUNCTION public.admin_reply(p_ticket uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
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

-- ---------- 8. Rewrite admin_fetch_ticket_messages (add admin check) ----------
CREATE OR REPLACE FUNCTION public.admin_fetch_ticket_messages(p_ticket uuid)
RETURNS SETOF support_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM support_messages
  WHERE ticket_id = p_ticket
    AND public.is_platform_admin()
  ORDER BY created_at ASC;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_fetch_ticket_messages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_fetch_ticket_messages(uuid) TO authenticated;
