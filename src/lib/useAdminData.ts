import { useCallback, useEffect, useState } from 'react';
import type { DepositRequest, Job, ProofSubmission, WithdrawRequest } from '@/types';
import { toDeposit, toJob, toProof, toWithdraw } from '@/lib/mappers';
import {
  adminFetchDeposits, adminFetchProofs, adminFetchUsers, adminFetchWithdrawals,
  fetchAllJobs, type Profile,
} from '@/lib/supabase';

export interface AdminData {
  users: Profile[];
  deposits: DepositRequest[];
  withdrawals: WithdrawRequest[];
  jobs: Job[];
  proofs: ProofSubmission[];
  reload: () => Promise<void>;
}

export function useAdminData(): AdminData {
  const [data, setData] = useState<Omit<AdminData, 'reload'>>({
    users: [], deposits: [], withdrawals: [], jobs: [], proofs: [],
  });

  const reload = useCallback(async () => {
    const [users, deposits, withdrawals, jobs, proofs] = await Promise.all([
      adminFetchUsers(),
      adminFetchDeposits(),
      adminFetchWithdrawals(),
      fetchAllJobs(),
      adminFetchProofs(),
    ]);
    setData({
      users,
      deposits: deposits.map(toDeposit),
      withdrawals: withdrawals.map(toWithdraw),
      jobs: jobs.map(toJob),
      proofs: proofs.map(toProof),
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...data, reload };
}
