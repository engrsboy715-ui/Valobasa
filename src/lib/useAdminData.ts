import { useCallback, useEffect, useState } from 'react';
import type { DepositRequest, Job, ProofSubmission, WithdrawRequest } from '@/types';
import { toDeposit, toJob, toProof, toWithdraw } from '@/lib/mappers';
import {
  adminFetchDeposits, adminFetchPartnerKeys, adminFetchProfitBreakdown, adminFetchProofs,
  adminFetchUsers, adminFetchWithdrawals, fetchAllJobs,
  type AdminPartnerKeyRow, type AdminProfitBreakdown, type Profile,
} from '@/lib/supabase';

export interface AdminData {
  users: Profile[];
  deposits: DepositRequest[];
  withdrawals: WithdrawRequest[];
  jobs: Job[];
  proofs: ProofSubmission[];
  partnerKeys: AdminPartnerKeyRow[];
  profit: AdminProfitBreakdown;
  reload: () => Promise<void>;
}

export function useAdminData(): AdminData {
  const [data, setData] = useState<Omit<AdminData, 'reload'>>({
    users: [], deposits: [], withdrawals: [], jobs: [], proofs: [], partnerKeys: [],
    profit: { task_service_charge: 0, partner_key_fee: 0 },
  });

  const reload = useCallback(async () => {
    const [users, deposits, withdrawals, jobs, proofs, partnerKeys, profit] = await Promise.all([
      adminFetchUsers(),
      adminFetchDeposits(),
      adminFetchWithdrawals(),
      fetchAllJobs(),
      adminFetchProofs(),
      adminFetchPartnerKeys(),
      adminFetchProfitBreakdown(),
    ]);
    setData({
      users,
      deposits: deposits.map(toDeposit),
      withdrawals: withdrawals.map(toWithdraw),
      jobs: jobs.map(toJob),
      proofs: proofs.map(toProof),
      partnerKeys,
      profit,
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...data, reload };
}
