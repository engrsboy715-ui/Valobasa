/*
# Create app_settings table for admin-managed app values

## Summary
Stores values that the admin can change from the admin panel and that every
signed-in user sees. The first value is the app download link shared from the
referral page.

## New Tables
- `app_settings`
  - `key` (text, primary key) — name of the setting, e.g. `download_link`
  - `value` (text, not null) — the setting's value
  - `updated_at` (timestamptz, defaults to now())

## Security
- RLS enabled.
- Any signed-in user can read settings.
- Only admins (profiles.is_admin = true) can insert, update, or delete settings.
- Grants: SELECT, INSERT, UPDATE, DELETE to authenticated (RLS limits writes to admins).
*/

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON app_settings TO authenticated;

DROP POLICY IF EXISTS "select_app_settings" ON app_settings;
CREATE POLICY "select_app_settings"
  ON app_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_app_settings" ON app_settings;
CREATE POLICY "insert_app_settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

DROP POLICY IF EXISTS "update_app_settings" ON app_settings;
CREATE POLICY "update_app_settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));

DROP POLICY IF EXISTS "delete_app_settings" ON app_settings;
CREATE POLICY "delete_app_settings"
  ON app_settings FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
