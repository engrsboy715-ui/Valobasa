/*
# Add wallet columns and rank to profiles

1. Modified Tables
- `profiles`
  - `balance` (numeric, default 0) — current Taka balance. Only admin-approved deposits increase this.
  - `coins` (integer, default 0) — loyalty coin balance.
  - `rank` (integer, default 0) — leaderboard rank. 0 means unranked (new user).

2. Security
- RLS already enabled. Existing owner-scoped SELECT/INSERT/UPDATE policies remain.
- No new policies needed; users can still read and update only their own row.
- Balance/coins/rank are client-readable so the home screen can display them,
  but updates are still gated to the owner row only. Admin-driven balance
  changes go through the service role (server side), not the anon client.

3. Notes
- New users start at balance 0.00, coins 0, rank 0.
- Values are numeric so partial-Taka precision is preserved.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank integer NOT NULL DEFAULT 0;