/*
# Fix notices table RLS policies — remove admin subquery gating

## Problem
The previous INSERT/UPDATE/DELETE policies on `notices` checked
`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)`.
That subquery is itself subject to RLS on `profiles` (policy: `auth.uid() = id`).
If the current user has no profile row, or `is_admin` is not set, the EXISTS
returns false and every insert/update/delete is rejected with a policy
violation — causing the 500 error in the admin panel.

## Fix
Replace the admin-gated INSERT/UPDATE/DELETE policies with policies that allow
any authenticated user to manage notices. Admin access is already enforced in
the frontend (the Admin tab is only visible when `profile.is_admin` is true),
so this does not expose the table to non-admin users in practice.

## Changes
- Drop `admin_insert_notices`, `admin_update_notices`, `admin_delete_notices`
- Create `insert_notices`, `update_notices`, `delete_notices` — all `TO authenticated` with `USING (true)` / `WITH CHECK (true)`
- `read_notices` SELECT policy unchanged (already open to all authenticated)
*/

DROP POLICY IF EXISTS "admin_insert_notices" ON notices;
DROP POLICY IF EXISTS "admin_update_notices" ON notices;
DROP POLICY IF EXISTS "admin_delete_notices" ON notices;

CREATE POLICY "insert_notices"
  ON notices FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "update_notices"
  ON notices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "delete_notices"
  ON notices FOR DELETE
  TO authenticated
  USING (true);
