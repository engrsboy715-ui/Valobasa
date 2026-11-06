/*
# Auto-assign admin role on signup

## Problem
The `is_admin` column on `profiles` is not client-updatable (column-level grant
restricts UPDATE to `full_name` and `email` only). When the designated admin
email (mdesrafil2510@gmail.com) signs up, their `is_admin` stays `false` because
the frontend `upsertProfile()` call cannot set it. The admin then has no access
to admin functions until someone manually runs `UPDATE profiles SET is_admin =
true WHERE lower(email) = 'mdesrafil2510@gmail.com'`.

## Fix
Add a BEFORE INSERT trigger on `profiles` that checks the incoming email. If it
matches `mdesrafil2510@gmail.com` (case-insensitive), set `is_admin = true` on
the new row. For all other emails, `is_admin` keeps its column default of
`false`.

## Security
- The trigger is SECURITY DEFINER so it can set `is_admin` regardless of the
  caller's column-level grants.
- The admin email is hardcoded in the trigger body (not user-editable).
- EXECUTE is revoked from PUBLIC/anon; the trigger fires automatically on
  INSERT, not via direct RPC calls.
- Existing rows are backfilled: any profile with the admin email that currently
  has `is_admin = false` is corrected.
*/

-- ---------- 1. Backfill existing admin profiles ----------
UPDATE profiles SET is_admin = true WHERE lower(email) = 'mdesrafil2510@gmail.com';

-- ---------- 2. Trigger function ----------
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'mdesrafil2510@gmail.com' THEN
    NEW.is_admin := true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_assign_admin_role() FROM PUBLIC, anon;

-- ---------- 3. Attach trigger ----------
DROP TRIGGER IF EXISTS profiles_auto_assign_admin ON profiles;
CREATE TRIGGER profiles_auto_assign_admin
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_admin_role();
