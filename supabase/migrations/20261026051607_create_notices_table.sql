/*
# Create notices table for admin-published announcements

1. New Tables
- `notices`
  - `id` (uuid, primary key)
  - `title` (text, not null) — short heading of the announcement
  - `body` (text, not null) — full description text
  - `active` (boolean, default true) — admin can toggle visibility without deleting
  - `created_at` (timestamptz, default now()) — publish timestamp shown to users
2. Security
- Enable RLS on `notices`.
- Grant SELECT to `authenticated` so all signed-in users can read active notices.
- Grant INSERT/UPDATE/DELETE to `authenticated` (admin gating is enforced via the
  `is_admin` flag on `profiles`; a non-admin attempting writes will be rejected
  by the policy's `is_admin` check).
- SELECT policy: any authenticated user can read all notices (announcements are
  shared/public within the app).
- INSERT/UPDATE/DELETE policies: only users whose `profiles.is_admin` is true.
*/

CREATE TABLE IF NOT EXISTS notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON notices TO authenticated;
GRANT INSERT, UPDATE, DELETE ON notices TO authenticated;

-- All authenticated users can read notices (announcements are shared)
DROP POLICY IF EXISTS "read_notices" ON notices;
CREATE POLICY "read_notices"
  ON notices FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can create notices
DROP POLICY IF EXISTS "admin_insert_notices" ON notices;
CREATE POLICY "admin_insert_notices"
  ON notices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Only admins can update notices
DROP POLICY IF EXISTS "admin_update_notices" ON notices;
CREATE POLICY "admin_update_notices"
  ON notices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Only admins can delete notices
DROP POLICY IF EXISTS "admin_delete_notices" ON notices;
CREATE POLICY "admin_delete_notices"
  ON notices FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );
