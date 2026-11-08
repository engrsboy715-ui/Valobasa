import type { DepositMethod, DepositRequest, Job, JobLevel, JobStatus, Platform, ProofSubmission, WithdrawRequest } from '@/types';
import type { AdminDepositRow, AdminWithdrawalRow, JobRow, ProofRow } from '@/lib/supabase';

export function toDeposit(row: AdminDepositRow): DepositRequest {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    amount: Number(row.amount),
    method: row.method as DepositMethod,
    senderNumber: row.sender_number,
    trxId: row.trx_id,
    screenshot: row.screenshot,
    status: row.status as DepositRequest['status'],
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function toWithdraw(row: AdminWithdrawalRow): WithdrawRequest {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    amount: Number(row.amount),
    serviceCharge: Number(row.service_charge),
    totalDeducted: Number(row.total_deducted),
    method: row.method as DepositMethod,
    receiverNumber: row.receiver_number,
    status: row.status as WithdrawRequest['status'],
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function toJob(row: JobRow): Job {
  return {
    id: row.id,
    workId: row.work_id,
    platform: row.platform as Platform,
    subTaskType: row.sub_task_type,
    jobTitle: row.job_title,
    rate: Number(row.rate),
    totalWorkers: row.total_workers,
    availableSlots: row.available_slots,
    level: row.level as JobLevel,
    locked: row.locked,
    employerName: row.employer_name,
    employerIsPartner: row.employer_is_partner,
    referenceScreenshot: row.reference_screenshot,
    pageLink: row.page_link ?? undefined,
    pageName: row.page_name,
    commentLines: row.comment_lines ?? [],
    instructions: row.instructions ?? [],
    status: row.status as JobStatus,
    subtotal: Number(row.subtotal),
    serviceCharge: Number(row.service_charge),
    totalCost: Number(row.total_cost),
    buyerId: row.user_id,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function toProof(row: ProofRow): ProofSubmission {
  return {
    id: row.id,
    jobId: row.job_id,
    workId: row.work_id,
    workerId: row.worker_id,
    workerName: row.worker_name,
    screenshot: row.screenshot,
    screenshots: row.screenshots ?? [],
    status: row.status as ProofSubmission['status'],
    reward: Number(row.reward),
    submittedAt: new Date(row.submitted_at).getTime(),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : undefined,
    rejectionReason: row.rejection_reason ?? undefined,
  };
}
