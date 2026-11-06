export type Platform =
  | 'Facebook'
  | 'YouTube'
  | 'TikTok'
  | 'Instagram'
  | 'Feeder App';

export type JobLevel = 'Level 1' | 'Level 2' | 'Level 3';

export type JobStatus = 'Active' | 'Pending' | 'Completed' | 'Rejected';

export interface Job {
  id: string;
  workId: string;
  platform: Platform;
  subTaskType: string;
  jobTitle: string;
  rate: number; // BDT per worker (net payout)
  totalWorkers: number;
  availableSlots: number;
  level: JobLevel;
  locked: boolean;
  employerName: string;
  referenceScreenshot: string;
  pageLink?: string;
  pageName: string;
  commentLines: string[]; // selective comment lines, 1 per line
  instructions: string[]; // step-by-step
  status: JobStatus;
  subtotal: number;
  serviceCharge: number;
  totalCost: number;
  buyerId: string;
  createdAt: number;
}

export type TxnType =
  | 'reward'
  | 'deposit'
  | 'deposit_rejected'
  | 'withdraw'
  | 'spend'
  | 'penalty'
  | 'coin';

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number; // BDT (positive)
  description: string;
  createdAt: number;
}

export interface ProofSubmission {
  id: string;
  jobId: string;
  workId: string;
  workerId: string;
  workerName: string;
  screenshot: string;
  screenshots: string[];
  status: 'Pending' | 'Approved' | 'Rejected';
  reward: number;
  submittedAt: number;
  reviewedAt?: number;
  rejectionReason?: string;
}

export interface ActiveWork {
  jobId: string;
  workId: string;
  acceptedAt: number;
}

export type DepositMethod =
  | 'bKash Personal'
  | 'Nagad Personal'
  | 'Rocket Personal'
  | 'Upay Personal';

export interface DepositRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  method: DepositMethod;
  senderNumber: string;
  trxId: string;
  screenshot: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  supabaseUserId?: string;
}

export interface WithdrawRequest {
  id: string;
  userId: string;
  userName: string;
  amount: number; // net amount the user wants to receive
  serviceCharge: number; // 25% service charge on top
  totalDeducted: number; // amount + serviceCharge, deducted from balance
  method: DepositMethod;
  receiverNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
  level: JobLevel;
  balance: number;
  coins: number;
  lifetimeEarnings: number;
  totalDeposit: number;
  totalWithdraw: number;
  totalSpend: number;
  totalPenalty: number;
  blocked: boolean;
  createdAt: number;
  transactions: Transaction[];
}

export interface WalletState {
  balance: number;
  coins: number;
  lifetimeEarnings: number;
  totalDeposit: number;
  totalWithdraw: number;
  totalSpend: number;
  totalPenalty: number;
}

export interface Settings {
  serviceChargePercent: number; // e.g. 25
  minWorkers: number; // e.g. 5
}
