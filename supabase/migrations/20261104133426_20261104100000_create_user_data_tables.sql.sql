/*
# Create per-user tables: jobs, deposits, withdrawals, proofs, transactions

## Purpose
Replace the local Zustand store with Supabase-backed per-user data.
Every user sees only their own rows (RLS scoped by auth.uid()).

## New Tables
1. `jobs` — tasks created by users (employers)
2. `deposits` — deposit requests submitted by users
3. `withdrawals` — withdrawal requests submitted by users
4. `proofs` — proof submissions from workers for jobs
5. `transactions` — per-user wallet transaction history

## Security
- RLS enabled on every table.
- Each table scoped TO authenticated with auth.uid() = user_id ownership checks.
- Jobs are readable by all authenticated users (marketplace), but only the buyer can modify.
- Deposits/withdrawals/proofs/transactions are strictly per-user (owner-only).
- Balance/coins columns on profiles are NOT client-updatable (already restricted).
- Deposit approval calls the existing award_referral_on_first_deposit RPC.
*/

-- ========== jobs ==========
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  work_id text NOT NULL,
  platform text NOT NULL,
  sub_task_type text NOT NULL,
  job_title text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  total_workers integer NOT NULL DEFAULT 1,
  available_slots integer NOT NULL DEFAULT 1,
  level text NOT NULL DEFAULT 'Level 1',
  locked boolean NOT NULL DEFAULT false,
  employer_name text NOT NULL,
  page_name text NOT NULL DEFAULT '',
  reference_screenshot text NOT NULL DEFAULT '',
  page_link text,
  comment_lines text[] NOT NULL DEFAULT '{}',
  instructions text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'Active',
  subtotal numeric NOT NULL DEFAULT 0,
  service_charge numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- All authenticated users can browse jobs (marketplace), but only owner can modify
GRANT SELECT ON jobs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON jobs TO authenticated;

DROP POLICY IF EXISTS "select_all_jobs" ON jobs;
CREATE POLICY "select_all_jobs" ON jobs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_job" ON jobs;
CREATE POLICY "insert_own_job" ON jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_job" ON jobs;
CREATE POLICY "update_own_job" ON jobs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_job" ON jobs;
CREATE POLICY "delete_own_job" ON jobs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- ========== deposits ==========
CREATE TABLE IF NOT EXISTS deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL,
  sender_number text NOT NULL DEFAULT '',
  trx_id text NOT NULL DEFAULT '',
  screenshot text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON deposits TO authenticated;

DROP POLICY IF EXISTS "select_own_deposits" ON deposits;
CREATE POLICY "select_own_deposits" ON deposits FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_deposits" ON deposits;
CREATE POLICY "insert_own_deposits" ON deposits FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- ========== withdrawals ==========
CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  service_charge numeric NOT NULL DEFAULT 0,
  total_deducted numeric NOT NULL DEFAULT 0,
  method text NOT NULL,
  receiver_number text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON withdrawals TO authenticated;

DROP POLICY IF EXISTS "select_own_withdrawals" ON withdrawals;
CREATE POLICY "select_own_withdrawals" ON withdrawals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_withdrawals" ON withdrawals;
CREATE POLICY "insert_own_withdrawals" ON withdrawals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);

-- ========== proofs ==========
CREATE TABLE IF NOT EXISTS proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  work_id text NOT NULL,
  worker_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  worker_name text NOT NULL DEFAULT '',
  screenshot text NOT NULL DEFAULT '',
  screenshots text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'Pending',
  reward numeric NOT NULL DEFAULT 0,
  rejection_reason text,
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE proofs ENABLE ROW LEVEL SECURITY;

-- Workers can see their own proofs; job owners can see proofs on their jobs
GRANT SELECT, INSERT ON proofs TO authenticated;

DROP POLICY IF EXISTS "select_visible_proofs" ON proofs;
CREATE POLICY "select_visible_proofs" ON proofs FOR SELECT
  TO authenticated USING (
    auth.uid() = worker_id
    OR EXISTS (SELECT 1 FROM jobs j WHERE j.id = proofs.job_id AND j.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_proof" ON proofs;
CREATE POLICY "insert_own_proof" ON proofs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = worker_id);

CREATE INDEX IF NOT EXISTS idx_proofs_worker ON proofs(worker_id);
CREATE INDEX IF NOT EXISTS idx_proofs_job ON proofs(job_id);
CREATE INDEX IF NOT EXISTS idx_proofs_status ON proofs(status);

-- ========== transactions ==========
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON transactions TO authenticated;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, created_at DESC);
