import { useState, useEffect, useCallback, useRef } from 'react';
import { useAdminData, type AdminData } from '@/lib/useAdminData';
import { APP_SETTINGS } from '@/lib/appSettings';
import { bdt, bdtPlain, timeAgo, coinsToBdtDisplay } from '@/lib/format';
import type { JobLevel, ProofSubmission } from '@/types';
import { cn } from '@/lib/cn';
import { Toast } from '@/components/ui';
import { useLanguage } from '@/lib/LanguageContext';
import { CASH_OUT_RATE_PER_1000, cashOutCharge } from '@/lib/paymentRates';
import {
  supabase,
  adminFetchAllKyc, adminReviewKyc, adminFetchTickets, adminReply, adminFetchTicketMessages,
  adminApproveDeposit, adminRejectDeposit, adminApproveWithdrawal, adminRejectWithdrawal,
  approveProofRPC, rejectProofRPC,
  fetchAllNotices, createNotice, toggleNoticeActive, deleteNotice, type Notice,
  fetchTutorials, createTutorial, deleteTutorial, type Tutorial,
  type AdminKycRow, type AdminTicketRow, type SupportMessage,
} from '@/lib/supabase';
import {
  ChevronLeft, LayoutDashboard, Image as ImageIcon, Users, Wallet as WalletIcon,
  Settings as SettingsIcon, Check, X, Clock, Shield, ShieldOff, Ban, CircleDollarSign,
  TrendingUp, TrendingDown, AlertCircle, MessageSquare, Plus, Minus,
  ShieldCheck, MessageCircle, Gift, Send, Loader2, IdCard,
  Banknote, AlertTriangle, TrendingUp as TrendingUpIcon, DollarSign, Receipt,
  ArrowUpFromLine, Megaphone, Trash2, EyeOff, Eye, Video, Upload,
} from 'lucide-react';

type Section = 'dashboard' | 'finance' | 'proofs' | 'deposits' | 'withdrawals' | 'users' | 'settings' | 'kyc' | 'support' | 'tutorials' | 'referrals' | 'notices';

export function AdminView({ onExit }: { onExit: () => void }) {
  const [section, setSection] = useState<Section>('dashboard');
  const admin = useAdminData();
  return (
    <div className="min-h-screen bg-slate-100">
      {/* Admin header */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-900 text-white">
        <div className="flex items-center gap-2 px-3 py-3">
          <button onClick={onExit} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:scale-95">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-violet-400" />
            <h1 className="text-base font-bold">Admin Dashboard</h1>
          </div>
        </div>
        {/* Section tabs */}
        <div className="flex gap-1 overflow-x-auto px-2 pb-2">
          {([
            ['dashboard', 'Overview', LayoutDashboard],
            ['finance', 'Finance', Banknote],
            ['proofs', 'Proofs', ImageIcon],
            ['deposits', 'Deposits', TrendingUp],
            ['withdrawals', 'Withdrawals', TrendingDown],
            ['users', 'Users', Users],
            ['kyc', 'KYC', ShieldCheck],
            ['support', 'Support', MessageCircle],
            ['tutorials', 'Tutorials', Video],
            ['referrals', 'Referrals', Gift],
            ['notices', 'Notices', Megaphone],
            ['settings', 'Settings', SettingsIcon],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                section === key ? 'bg-violet-600 text-white' : 'bg-white/10 text-slate-300'
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-24">
        {section === 'dashboard' && <Dashboard admin={admin} />}
        {section === 'finance' && <FinanceDashboard admin={admin} />}
        {section === 'proofs' && <Proofs admin={admin} />}
        {section === 'deposits' && <Deposits admin={admin} />}
        {section === 'withdrawals' && <Withdrawals admin={admin} />}
        {section === 'users' && <UsersSection admin={admin} />}
        {section === 'kyc' && <KycSection />}
        {section === 'support' && <SupportSection />}
        {section === 'tutorials' && <TutorialsSection />}
        {section === 'referrals' && <ReferralsSection />}
        {section === 'notices' && <NoticesSection />}
        {section === 'settings' && <SettingsSection />}
      </div>
    </div>
  );
}

// ---------- Finance Dashboard ----------
function FinanceDashboard({ admin }: { admin: AdminData }) {
  const { users, deposits, withdrawals, jobs } = admin;

  // 1. Total User Wallet Liability — sum of all users' balances
  const activeUsers = users;
  const totalWalletLiability = users.reduce((sum, u) => sum + Number(u.balance), 0);

  // 2a. Deposit Profit = sum of cash-out charges for each approved deposit
  //     (user sends amount + cash-out charge; admin keeps the cash-out charge)
  const approvedDeposits = deposits.filter((d) => d.status === 'approved');
  const depositProfit = approvedDeposits.reduce(
    (sum, d) => sum + cashOutCharge(d.amount, d.method),
    0
  );

  // Per-method breakdown for the UI
  const depositByMethod = approvedDeposits.reduce((acc, d) => {
    const charge = cashOutCharge(d.amount, d.method);
    const entry = acc[d.method] ?? { count: 0, charge: 0 };
    entry.count += 1;
    entry.charge += charge;
    acc[d.method] = entry;
    return acc;
  }, {} as Record<string, { count: number; charge: number }>);

  // 2b. Order Service Fee (25%) = Total Completed Order Amount * 0.25
  const completedJobs = jobs.filter((j) => j.status === 'Completed');
  const completedOrderAmount = completedJobs.reduce((sum, j) => sum + j.subtotal, 0);
  const orderServiceFee = completedOrderAmount * 0.25;

  // 2c. Withdrawal Service Fee (25%) = Total Processed Withdrawal Amount * 0.25
  const processedWithdrawals = withdrawals.filter((w) => w.status === 'approved');
  const processedWithdrawalAmount = processedWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const withdrawalServiceFee = processedWithdrawalAmount * 0.25;

  // 3. Net Admin Profit
  const netAdminProfit = depositProfit + orderServiceFee + withdrawalServiceFee;

  // 4. Required bKash Balance
  const requiredBkashBalance = totalWalletLiability + netAdminProfit;

  // Recent transactions for the table
  type TxnRow = {
    id: string;
    type: 'Deposit' | 'Task Order' | 'Withdrawal';
    user: string;
    amount: number;
    status: string;
    date: number;
  };

  const txnRows: TxnRow[] = [
    ...deposits.map((d) => ({
      id: d.id,
      type: 'Deposit' as const,
      user: d.userName,
      amount: d.amount,
      status: d.status,
      date: d.createdAt,
    })),
    ...jobs.map((j) => ({
      id: j.id,
      type: 'Task Order' as const,
      user: j.employerName,
      amount: j.totalCost,
      status: j.status === 'Completed' ? 'approved' : j.status === 'Active' ? 'pending' : 'rejected',
      date: j.createdAt,
    })),
    ...withdrawals.map((w) => ({
      id: w.id,
      type: 'Withdrawal' as const,
      user: w.userName,
      amount: w.amount,
      status: w.status,
      date: w.createdAt,
    })),
  ].sort((a, b) => b.date - a.date).slice(0, 20);

  return (
    <div className="space-y-5">
      {/* Section title */}
      <div className="flex items-center gap-2">
        <Banknote size={20} className="text-violet-600" />
        <h2 className="text-base font-bold text-slate-800">Financial Overview</h2>
      </div>

      {/* TOP SUMMARY CARDS */}
      <div className="space-y-3">
        {/* Total User Wallet Liability — Light Red/Warning */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 p-4 ring-1 ring-rose-200">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-rose-200/40" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-200 text-rose-700">
                <AlertTriangle size={20} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Total User Wallet Liability</p>
                <p className="text-[10px] font-medium text-rose-500">Reserve Funds in bKash — Do Not Touch</p>
              </div>
            </div>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-rose-800">{bdt(totalWalletLiability)}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-rose-600">
              <Users size={12} /> {activeUsers.length} active users
            </div>
          </div>
        </div>

        {/* Admin Net Available Profit — Emerald Green/Gold */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow-lg shadow-emerald-600/20 ring-1 ring-emerald-400">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/20" />
          <div className="absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-amber-900">
                <DollarSign size={20} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">Admin Net Available Profit</p>
                <p className="text-[10px] font-medium text-emerald-200">Safe earnings — withdraw for personal use</p>
              </div>
            </div>
            <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">{bdt(netAdminProfit)}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-emerald-100">
              <TrendingUpIcon size={12} /> Net = Deposit + Order Fee + Withdrawal Fee
            </div>
          </div>
        </div>
      </div>

      {/* PROFIT BREAKDOWN CARDS */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-700">Profit Breakdown</h3>
        <div className="grid grid-cols-1 gap-3">
          {/* Deposit Profit */}
          <div className="flex items-center gap-3 rounded-2xl bg-blue-50 p-3.5 ring-1 ring-blue-200">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <Receipt size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">Deposit Profit (Cash-out Charges)</p>
              <p className="text-[10px] text-slate-500">
                {approvedDeposits.length} approved deposits · dynamic per-method rates
              </p>
              {Object.entries(depositByMethod).length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Object.entries(depositByMethod).map(([method, info]) => (
                    <span key={method} className="badge bg-blue-100 text-[9px] text-blue-700">
                      {method.replace(' Personal', '')}: {info.count}× · {bdtPlain(info.charge)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className="shrink-0 text-lg font-extrabold text-slate-900">{bdt(depositProfit)}</p>
          </div>
          {/* Order Service Fee */}
          <ProfitCard
            icon={<TrendingUpIcon size={18} />}
            label="Order Service Fee (25%)"
            formula={`${completedJobs.length} completed orders × 25%`}
            value={orderServiceFee}
            tone="bg-violet-50 ring-violet-200 icon-violet"
          />
          {/* Withdrawal Service Fee */}
          <ProfitCard
            icon={<ArrowUpFromLine size={18} />}
            label="Withdrawal Service Fee (25%)"
            formula={`${processedWithdrawals.length} processed withdrawals × 25%`}
            value={withdrawalServiceFee}
            tone="bg-amber-50 ring-amber-200 icon-amber"
          />
        </div>
      </div>

      {/* Net Profit Summary */}
      <div className="rounded-2xl bg-slate-900 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Net Admin Profit</p>
            <p className="text-2xl font-extrabold text-emerald-400">{bdt(netAdminProfit)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Required bKash Balance</p>
            <p className="text-2xl font-extrabold text-white">{bdt(requiredBkashBalance)}</p>
          </div>
        </div>
        <div className="mt-3 border-t border-slate-700 pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Liability + Profit</span>
            <span className="font-semibold text-slate-300">{bdt(totalWalletLiability)} + {bdt(netAdminProfit)}</span>
          </div>
        </div>
      </div>

      {/* TRANSACTIONS TABLE */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-700">Recent Transactions</h3>
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_70px_80px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            <span>Type / User</span>
            <span className="text-right">Amount</span>
            <span className="text-center">Status</span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {txnRows.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-slate-400">No transactions yet.</div>
            )}
            {txnRows.map((row) => (
              <div key={`${row.type}-${row.id}`} className="grid grid-cols-[1fr_70px_80px] items-center gap-2 px-3 py-3 text-sm transition hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold',
                      row.type === 'Deposit' ? 'bg-blue-100 text-blue-700' :
                      row.type === 'Task Order' ? 'bg-violet-100 text-violet-700' :
                      'bg-amber-100 text-amber-700'
                    )}>
                      {row.type === 'Deposit' ? 'D' : row.type === 'Task Order' ? 'T' : 'W'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">{row.type}</p>
                      <p className="truncate text-[10px] text-slate-400">{row.user} · {timeAgo(row.date)}</p>
                    </div>
                  </div>
                </div>
                <span className="text-right text-xs font-bold text-slate-700">{bdtPlain(row.amount)}</span>
                <span className="flex justify-center">
                  <StatusPill status={
                    row.status === 'pending' || row.status === 'Pending' ? 'Pending' :
                    row.status === 'approved' || row.status === 'Approved' ? 'Approved' :
                    row.status === 'Active' ? 'Pending' : 'Rejected'
                  } />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Formula reference */}
      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <h3 className="text-sm font-bold text-slate-800">Calculation Reference</h3>
        <div className="mt-2 space-y-1.5 text-xs text-slate-500">
          <p><span className="font-semibold text-slate-700">Deposit Profit</span> = Σ (each approved deposit amount × method cash-out rate per 1000)</p>
          <p className="pl-3 text-slate-400">bKash ৳18.5/1000 · Nagad ৳14.5/1000 · Rocket ৳18.5/1000 · Upay ৳15/1000</p>
            
          <p><span className="font-semibold text-slate-700">Order Service Fee</span> = Completed Order Amount × 25%</p>
          <p><span className="font-semibold text-slate-700">Withdrawal Service Fee</span> = Processed Withdrawal Amount × 25%</p>
          <p><span className="font-semibold text-slate-700">Net Admin Profit</span> = Deposit Profit + Order Fee + Withdrawal Fee</p>
          <p><span className="font-semibold text-slate-700">Required bKash Balance</span> = User Wallet Liability + Net Admin Profit</p>
        </div>
      </div>
    </div>
  );
}

function ProfitCard({ icon, label, formula, value, tone }: { icon: React.ReactNode; label: string; formula: string; value: number; tone: string }) {
  const toneClasses: Record<string, { bg: string; icon: string }> = {
    'bg-blue-50 ring-blue-200 icon-blue': { bg: 'bg-blue-50 ring-1 ring-blue-200', icon: 'bg-blue-100 text-blue-700' },
    'bg-violet-50 ring-violet-200 icon-violet': { bg: 'bg-violet-50 ring-1 ring-violet-200', icon: 'bg-violet-100 text-violet-700' },
    'bg-amber-50 ring-amber-200 icon-amber': { bg: 'bg-amber-50 ring-1 ring-amber-200', icon: 'bg-amber-100 text-amber-700' },
  };
  const tc = toneClasses[tone] ?? { bg: 'bg-slate-50 ring-1 ring-slate-200', icon: 'bg-slate-100 text-slate-700' };

  return (
    <div className={cn('flex items-center gap-3 rounded-2xl p-3.5', tc.bg)}>
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tc.icon)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{label}</p>
        <p className="text-[10px] text-slate-500">{formula}</p>
      </div>
      <p className="shrink-0 text-lg font-extrabold text-slate-900">{bdt(value)}</p>
    </div>
  );
}

// ---------- Dashboard ----------
function Dashboard({ admin }: { admin: AdminData }) {
  const { jobs, proofs, deposits, withdrawals, users } = admin;
  const [kycCount, setKycCount] = useState(0);
  const [ticketCount, setTicketCount] = useState(0);
  const pendingProofs = proofs.filter((p) => p.status === 'Pending').length;
  const pendingDep = deposits.filter((d) => d.status === 'pending').length;
  const pendingWd = withdrawals.filter((w) => w.status === 'pending').length;
  const activeJobs = jobs.filter((j) => j.status === 'Active').length;

  useEffect(() => {
    (async () => {
      const kyc = await adminFetchAllKyc();
      setKycCount(kyc.filter((k) => k.status === 'pending').length);
      const tickets = await adminFetchTickets();
      setTicketCount(tickets.length);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Metric icon={<TrendingUp size={18} />} label="Active Jobs" value={`${activeJobs}`} tone="bg-emerald-100 text-emerald-700" />
        <Metric icon={<Clock size={18} />} label="Pending Proofs" value={`${pendingProofs}`} tone="bg-amber-100 text-amber-700" />
        <Metric icon={<WalletIcon size={18} />} label="Pending Deposits" value={`${pendingDep}`} tone="bg-blue-100 text-blue-700" />
        <Metric icon={<TrendingDown size={18} />} label="Pending Withdrawals" value={`${pendingWd}`} tone="bg-rose-100 text-rose-700" />
        <Metric icon={<ShieldCheck size={18} />} label="Pending KYC" value={`${kycCount}`} tone="bg-teal-100 text-teal-700" />
        <Metric icon={<MessageCircle size={18} />} label="Support Tickets" value={`${ticketCount}`} tone="bg-cyan-100 text-cyan-700" />
        <Metric icon={<Users size={18} />} label="Total Users" value={`${users.length}`} tone="bg-violet-100 text-violet-700" />
      </div>

      <h2 className="text-sm font-bold text-slate-700">Recent Proofs</h2>
      <div className="space-y-2">
        {proofs.slice(0, 4).map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
            <img src={p.screenshot} alt="" className="h-12 w-12 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{p.workerName}</p>
              <p className="text-xs text-slate-500">{p.workId} · {timeAgo(p.submittedAt)}</p>
            </div>
            <StatusPill status={p.status} />
          </div>
        ))}
        {proofs.length === 0 && <Empty text="No proofs submitted yet." />}
      </div>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 shadow-sm">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tone)}>{icon}</span>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

// ---------- Proofs ----------
function Proofs({ admin }: { admin: AdminData }) {
  const { proofs, jobs } = admin;
  const [reviewing, setReviewing] = useState<ProofSubmission | null>(null);
  const [reason, setReason] = useState('');
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  const pending = proofs.filter((p) => p.status === 'Pending');
  const reviewed = proofs.filter((p) => p.status !== 'Pending');

  const approve = async (id: string) => {
    const res = await approveProofRPC(id);
    setReviewing(null);
    setToast({ message: res.message, ok: res.success });
    await admin.reload();
  };
  const reject = async (id: string) => {
    if (!reason.trim()) { setToast({ message: 'Enter a rejection reason.', ok: false }); return; }
    const res = await rejectProofRPC(id, reason.trim());
    setReviewing(null); setReason('');
    setToast({ message: res.message, ok: res.success });
    await admin.reload();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-slate-700">Pending Review ({pending.length})</h2>
      {pending.length === 0 && <Empty text="No pending proofs." />}
      <div className="space-y-3">
        {pending.map((p) => {
          const job = jobs.find((j) => j.id === p.jobId);
          return (
            <div key={p.id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <img src={p.screenshot} alt="proof" className="h-16 w-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-800">{job?.jobTitle ?? p.workId}</p>
                  <p className="text-xs text-slate-500">Worker: {p.workerName}</p>
                  <p className="text-xs text-slate-500">Reward: {bdt(p.reward)} · {timeAgo(p.submittedAt)}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setReviewing(p)} className="brand-btn-soft flex-1 py-2 text-xs">
                  <ImageIcon size={14} /> Review
                </button>
                <button onClick={() => approve(p.id)} className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white active:scale-95">
                  <Check size={14} /> Approve
                </button>
                <button onClick={() => { setReviewing(p); }} className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-semibold text-white active:scale-95">
                  <X size={14} /> Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {reviewed.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-bold text-slate-700">Reviewed ({reviewed.length})</h2>
          <div className="space-y-2">
            {reviewed.slice(0, 12).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                <img src={p.screenshot} alt="" className="h-10 w-10 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{p.workerName}</p>
                  <p className="text-xs text-slate-500">{p.workId} · {bdt(p.reward)}</p>
                </div>
                <StatusPill status={p.status} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Review modal */}
      {reviewing && (
        <Modal onClose={() => { setReviewing(null); setReason(''); }} title="Review Proof">
          {(reviewing.screenshots && reviewing.screenshots.length > 0
            ? reviewing.screenshots
            : [reviewing.screenshot]
          ).map((src, i) => (
            <img key={i} src={src} alt={`proof ${i + 1}`} className="mb-2 w-full rounded-xl" />
          ))}
          <div className="mt-3 space-y-1 text-sm">
            <p><span className="text-slate-500">Worker:</span> <span className="font-semibold">{reviewing.workerName}</span></p>
            <p><span className="text-slate-500">Work ID:</span> <span className="font-mono">{reviewing.workId}</span></p>
            <p><span className="text-slate-500">Reward:</span> <span className="font-semibold text-emerald-600">{bdt(reviewing.reward)}</span></p>
          </div>
          <div className="mt-3">
            <label className="label">Rejection reason (required to reject)</label>
            <textarea className="input min-h-[70px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Screenshot does not show the followed page" />
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => approve(reviewing.id)} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white active:scale-95">
              <Check size={16} /> Approve & Credit
            </button>
            <button onClick={() => reject(reviewing.id)} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white active:scale-95">
              <X size={16} /> Reject
            </button>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast.message} onClose={() => setToast(null)} tone={toast.ok ? 'success' : 'error'} />}
    </div>
  );
}

// ---------- Deposits ----------
function Deposits({ admin }: { admin: AdminData }) {
  const { deposits } = admin;
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);

  const decide = async (id: string, approve: boolean) => {
    const res = approve ? await adminApproveDeposit(id) : await adminRejectDeposit(id);
    setToast({ message: res.message, ok: res.success });
    await admin.reload();
  };
  const pending = deposits.filter((d) => d.status === 'pending');
  const done = deposits.filter((d) => d.status !== 'pending');

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-slate-700">Pending Deposits ({pending.length})</h2>
      {pending.length === 0 && <Empty text="No pending deposit requests." />}
      <div className="space-y-3">
        {pending.map((d) => (
          <div key={d.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">{bdt(d.amount)}</p>
                <p className="text-xs text-slate-500">{d.userName} · {d.method}</p>
                <p className="text-xs text-slate-500">TrxID: {d.trxId} · Sender: {d.senderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScreenshot(d.screenshot)}
                className="shrink-0 overflow-hidden rounded-lg ring-1 ring-slate-200 transition hover:ring-violet-400 active:scale-95"
                aria-label="View deposit receipt"
              >
                <img src={d.screenshot} alt="Deposit receipt" className="h-14 w-14 object-cover" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => decide(d.id, true)} className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white active:scale-95">
                <Check size={14} /> Approve & Credit
              </button>
              <button onClick={() => decide(d.id, false)} className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-semibold text-white active:scale-95">
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mt-4 text-sm font-bold text-slate-700">History</h2>
          <div className="space-y-2">
            {done.slice(0, 12).map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{bdt(d.amount)} · {d.userName}</p>
                  <p className="text-xs text-slate-500">{d.method} · {timeAgo(d.createdAt)}</p>
                </div>
                <StatusPill status={d.status === 'approved' ? 'Approved' : 'Rejected'} />
              </div>
            ))}
          </div>
        </>
      )}

      {toast && <Toast message={toast.message} onClose={() => setToast(null)} tone={toast.ok ? 'success' : 'error'} />}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="relative flex max-h-full max-w-4xl items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSelectedScreenshot(null)}
              className="absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg"
              aria-label="Close receipt viewer"
            >
              <X size={18} />
            </button>
            <img src={selectedScreenshot} alt="Full deposit receipt" className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Withdrawals ----------
function Withdrawals({ admin }: { admin: AdminData }) {
  const { withdrawals } = admin;
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null);
  const pending = withdrawals.filter((w) => w.status === 'pending');
  const done = withdrawals.filter((w) => w.status !== 'pending');

  const decide = async (id: string, approve: boolean) => {
    const res = approve ? await adminApproveWithdrawal(id) : await adminRejectWithdrawal(id);
    setToast({ message: res.message, ok: res.success });
    await admin.reload();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-slate-700">Pending Withdrawals ({pending.length})</h2>
      {pending.length === 0 && <Empty text="No pending withdrawal requests." />}
      <div className="space-y-3">
        {pending.map((w) => (
          <div key={w.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">Net: {bdt(w.amount)}</p>
              <span className="text-xs font-semibold text-rose-600">Charge: {bdt(w.serviceCharge)}</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-violet-700">Total Deducted: {bdt(w.totalDeducted)}</p>
            <p className="mt-1 text-xs text-slate-500">{w.userName} · {w.method}</p>
            <p className="text-xs text-slate-500">To: {w.receiverNumber}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => decide(w.id, true)} className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white active:scale-95">
                <Check size={14} /> Approve
              </button>
              <button onClick={() => decide(w.id, false)} className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-semibold text-white active:scale-95">
                <X size={14} /> Reject & Refund
              </button>
            </div>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mt-4 text-sm font-bold text-slate-700">History</h2>
          <div className="space-y-2">
            {done.slice(0, 12).map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{bdt(w.amount)} · {w.userName}</p>
                  <p className="text-xs text-slate-500">{w.method} · {timeAgo(w.createdAt)}</p>
                </div>
                <StatusPill status={w.status === 'approved' ? 'Approved' : 'Rejected'} />
              </div>
            ))}
          </div>
        </>
      )}
      {toast && <Toast message={toast.message} onClose={() => setToast(null)} tone={toast.ok ? 'success' : 'error'} />}
    </div>
  );
}

// ---------- Users ----------
function UsersSection({ admin }: { admin: AdminData }) {
  const { users } = admin;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-slate-700">Users ({users.length})</h2>
      {users.length === 0 && <Empty text="No users yet." />}
      {users.map((u) => (
        <div key={u.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
              {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{u.full_name || 'No name'}</p>
              <p className="truncate text-xs text-slate-500">{u.email}</p>
              <p className="text-[10px] text-slate-400">Referral: {u.referral_code ?? '-'}</p>
            </div>
            <p className="text-sm font-bold text-violet-700">{bdt(Number(u.balance))}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Settings ----------
function SettingsSection() {
  const settings = APP_SETTINGS;

  return (
    <div className="space-y-4">
      <div className="card">
        <p className="text-sm font-bold text-slate-800">Current Values</p>
        <div className="mt-2 space-y-1.5 text-sm">
          <Row label="Service Charge" value={`${settings.serviceChargePercent}%`} />
          <Row label="Min Workers" value={`${settings.minWorkers}`} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

// ---------- KYC ----------
function KycSection() {
  const [rows, setRows] = useState<AdminKycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<AdminKycRow | null>(null);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    const data = await adminFetchAllKyc();
    setRows(data);
    setLoading(false);
  };

  const review = async (status: 'verified' | 'rejected') => {
    if (!reviewing) return;
    const res = await adminReviewKyc(reviewing.id, status, note.trim());
    setToast(res.message);
    setReviewing(null);
    setNote('');
    await load();
  };

  const pending = rows.filter((r) => r.status === 'pending');
  const done = rows.filter((r) => r.status !== 'pending');

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-slate-700">Pending KYC ({pending.length})</h2>
      {pending.length === 0 && <Empty text="No pending KYC submissions." />}
      <div className="space-y-3">
        {pending.map((k) => (
          <div key={k.id} className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-800">{k.full_name}</p>
                <p className="text-xs text-slate-500">{k.id_type} · {k.id_number}</p>
                <p className="text-xs text-slate-500">{k.country} · {timeAgo(new Date(k.created_at).getTime())}</p>
              </div>
              <StatusPill status={k.status === 'pending' ? 'Pending' : k.status === 'verified' ? 'Approved' : 'Rejected'} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setReviewing(k)} className="brand-btn-soft flex-1 py-2 text-xs">
                <IdCard size={14} /> Review
              </button>
              <button onClick={() => { setReviewing(k); }} className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white active:scale-95">
                <Check size={14} /> Verify
              </button>
              <button onClick={() => { setReviewing(k); }} className="flex-1 rounded-xl bg-rose-600 py-2 text-xs font-semibold text-white active:scale-95">
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <>
          <h2 className="mt-4 text-sm font-bold text-slate-700">Reviewed ({done.length})</h2>
          <div className="space-y-2">
            {done.slice(0, 12).map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{k.full_name}</p>
                  <p className="text-xs text-slate-500">{k.id_type} · {timeAgo(new Date(k.created_at).getTime())}</p>
                </div>
                <StatusPill status={k.status === 'verified' ? 'Approved' : 'Rejected'} />
              </div>
            ))}
          </div>
        </>
      )}

      {reviewing && (
        <Modal onClose={() => { setReviewing(null); setNote(''); }} title="Review KYC">
          <div className="space-y-2 text-sm">
            <p><span className="text-slate-500">Name:</span> <span className="font-semibold">{reviewing.full_name}</span></p>
            <p><span className="text-slate-500">ID Type:</span> <span className="font-semibold">{reviewing.id_type}</span></p>
            <p><span className="text-slate-500">ID Number:</span> <span className="font-semibold">{reviewing.id_number}</span></p>
            <p><span className="text-slate-500">Country:</span> <span className="font-semibold">{reviewing.country}</span></p>
            <p><span className="text-slate-500">Address:</span> <span className="font-semibold">{reviewing.address}</span></p>
            <p><span className="text-slate-500">DOB:</span> <span className="font-semibold">{reviewing.date_of_birth}</span></p>
            <p><span className="text-slate-500">Gender:</span> <span className="font-semibold">{reviewing.gender}</span></p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">ID Front</p>
              <img src={reviewing.id_front_img} alt="front" className="aspect-[3/4] w-full rounded-xl object-cover ring-1 ring-slate-200" />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">ID Back</p>
              <img src={reviewing.id_back_img} alt="back" className="aspect-[3/4] w-full rounded-xl object-cover ring-1 ring-slate-200" />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">Selfie</p>
              <img src={reviewing.selfie_img} alt="selfie" className="aspect-[3/4] w-full rounded-xl object-cover ring-1 ring-slate-200" />
            </div>
          </div>
          <div className="mt-3">
            <label className="label">Admin Note (optional)</label>
            <textarea className="input min-h-[60px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for approval/rejection" />
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => review('verified')} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white active:scale-95">
              <Check size={16} /> Verify
            </button>
            <button onClick={() => review('rejected')} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white active:scale-95">
              <X size={16} /> Reject
            </button>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} tone="success" />}
    </div>
  );
}

// ---------- Support ----------
function SupportSection() {
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<AdminTicketRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    const t = await adminFetchTickets();
    setTickets(t);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTickets();

    const channel = supabase
      .channel('admin_support_tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        () => loadTickets(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' },
        () => loadTickets(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTickets]);

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>;
  }

  if (active) {
    return (
      <AdminChatInterface
        ticket={active}
        onBack={() => setActive(null)}
        onToast={(msg) => setToast(msg)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">Support Tickets ({tickets.length})</h2>
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>
      {tickets.length === 0 && <Empty text="No support tickets yet." />}
      <div className="space-y-2.5">
        {tickets.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-slate-200/70 transition active:scale-[0.99] hover:ring-violet-200"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <MessageCircle size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{t.subject}</p>
              <p className="text-xs text-slate-400">{t.user_name} · {t.last_message ? timeAgo(new Date(t.updated_at).getTime()) : 'no messages'}</p>
              {t.last_message && <p className="mt-0.5 truncate text-xs text-slate-500">{t.last_message}</p>}
            </div>
            <StatusPill status={t.status === 'open' ? 'Pending' : 'Approved'} />
          </button>
        ))}
      </div>
    </div>
  );
}

function AdminChatInterface({ ticket, onBack, onToast }: { ticket: AdminTicketRow; onBack: () => void; onToast: (msg: string) => void }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const m = await adminFetchTicketMessages(ticket.id);
    setMessages(m);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [ticket.id]);

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`admin_ticket_${ticket.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticket.id}` },
        (payload) => {
          setMessages((prev) => {
            const newMsg = payload.new as SupportMessage;
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticket.id}` },
        () => loadMessages(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket.id, loadMessages]);

  const sendReply = async () => {
    if (reply.trim().length === 0) return;
    setSending(true);
    setReply('');
    const res = await adminReply(ticket.id, reply.trim());
    setSending(false);
    if (!res.success) {
      onToast(res.message);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col rounded-2xl bg-slate-50 ring-1 ring-slate-200 overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{ticket.subject}</p>
          <p className="text-xs text-slate-500">{ticket.user_name}</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          </div>
        ) : messages.length === 0 ? (
          <Empty text="No messages yet." />
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex', m.is_admin ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm', m.is_admin ? 'bg-violet-600 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-200')}>
                {!m.is_admin && <p className="mb-0.5 text-[10px] font-bold text-violet-600">{m.sender}</p>}
                {m.is_admin && <p className="mb-0.5 text-[10px] font-bold text-violet-200">Admin</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn('mt-1 text-[10px]', m.is_admin ? 'text-violet-200' : 'text-slate-400')}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200 bg-white px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
            placeholder="Type a reply…"
            className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
          />
          <button onClick={sendReply} disabled={sending || reply.trim().length === 0} className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white transition active:scale-90 disabled:opacity-50">
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Tutorials ----------
function TutorialsSection() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('admin_tutorials')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tutorials' },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    setLoading(true);
    const data = await fetchTutorials();
    setTutorials(data);
    setLoading(false);
  };

  const onFile = (file: File | undefined) => {
    if (!file) { setVideoUrl(''); return; }
    if (file.size > 50 * 1024 * 1024) {
      setToast('Video file is too large (max 50MB). Please choose a smaller file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setVideoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const publish = async () => {
    if (!title.trim() || !videoUrl) {
      setToast('Both title and video file are required.');
      return;
    }
    setSaving(true);
    const res = await createTutorial(title.trim(), videoUrl);
    setSaving(false);
    if (res.success) {
      setTitle('');
      setVideoUrl('');
      setShowForm(false);
      setToast(res.message);
      await load();
    } else {
      setToast(res.message);
    }
  };

  const remove = async (id: string) => {
    const res = await deleteTutorial(id);
    setToast(res.message);
    if (res.success) await load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-700">Video Tutorials ({tutorials.length})</h2>
          <p className="text-xs text-slate-500">Upload tutorial videos for users to learn task completion</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white active:scale-95"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancel' : 'Upload Video'}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="space-y-3">
            <div>
              <label className="label">Video Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. How to complete a Facebook Like task"
              />
            </div>
            <div>
              <label className="label">Video File</label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 transition hover:border-violet-400 hover:bg-violet-50/50">
                <Upload size={20} />
                {videoUrl ? 'Video selected. Tap to change.' : 'Tap to select a video from your gallery'}
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
              {videoUrl && (
                <div className="mt-2 overflow-hidden rounded-xl ring-1 ring-slate-200">
                  <video src={videoUrl} className="aspect-video w-full object-cover" controls muted />
                </div>
              )}
            </div>
            <button
              onClick={publish}
              disabled={saving || !title.trim() || !videoUrl}
              className="brand-btn w-full py-2.5 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Publish Tutorial
            </button>
          </div>
        </div>
      )}

      {tutorials.length === 0 && !showForm && (
        <Empty text="No tutorials uploaded yet. Tap 'Upload Video' to add one." />
      )}

      <div className="space-y-3">
        {tutorials.map((tut) => (
          <div key={tut.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
                <video src={tut.video_url} className="h-full w-full object-cover" muted preload="metadata" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{tut.title}</p>
                <p className="text-xs text-slate-500">{timeAgo(new Date(tut.created_at).getTime())}</p>
              </div>
              <button
                onClick={() => remove(tut.id)}
                className="flex items-center justify-center rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 active:scale-95"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} tone="success" />}
    </div>
  );
}

// ---------- Referrals ----------
function ReferralsSection() {
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-sm font-bold text-slate-800">Referral System</h2>
        <p className="mt-1 text-xs text-slate-500">Referral rewards are processed automatically in the database when a new user signs up with a referral code.</p>
        <div className="mt-3 space-y-2 text-sm">
          <Row label="Reward per referral" value="100 Coins each side" />
          <Row label="Conversion rate" value="100 Coins = 1 BDT" />
          <Row label="Referrer reward" value="+100 Coins (1 BDT)" />
          <Row label="New user reward" value="+100 Coins (1 BDT)" />
        </div>
      </div>
      <div className="card">
        <h2 className="text-sm font-bold text-slate-800">How it works</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>User A shares their unique referral code (auto-generated as ET + 6 chars).</li>
          <li>User B enters the code during signup.</li>
          <li>The <code className="rounded bg-slate-100 px-1 text-xs">apply_referral</code> function validates the code and awards 100 coins to both users instantly.</li>
          <li>Each referral is recorded in the <code className="rounded bg-slate-100 px-1 text-xs">referrals</code> table with both coin amounts.</li>
        </ol>
      </div>
    </div>
  );
}

// ---------- Notices ----------
function NoticesSection() {
  const { t } = useLanguage();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await fetchAllNotices();
    setNotices(data);
    setLoading(false);
  };

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      setToast(t('শিরোনাম ও বিবরণ উভয়ই প্রয়োজন।', 'Both title and description are required.'));
      return;
    }
    setSaving(true);
    const res = await createNotice(title.trim(), body.trim());
    setSaving(false);
    if (res.success) {
      setTitle(''); setBody(''); setShowForm(false);
      setToast(res.message);
      await load();
    } else {
      setToast(res.message);
    }
  };

  const toggle = async (n: Notice) => {
    const res = await toggleNoticeActive(n.id, !n.active);
    setToast(res.message);
    if (res.success) await load();
  };

  const remove = async (id: string) => {
    const res = await deleteNotice(id);
    setToast(res.message);
    if (res.success) await load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>;
  }

  const activeCount = notices.filter((n) => n.active).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-700">{t('নোটিশ ব্যবস্থাপনা', 'Notice Management')}</h2>
          <p className="text-xs text-slate-500">{t(`${activeCount} সক্রিয়`, `${activeCount} active`)} · {t(`${notices.length} মোট`, `${notices.length} total`)}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white active:scale-95"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? t('বাতিল', 'Cancel') : t('নতুন নোটিশ', 'New Notice')}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="space-y-3">
            <div>
              <label className="label">{t('শিরোনাম', 'Title')}</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('যেমন: নতুন পেমেন্ট সিস্টেম চালু', 'e.g. New payment system launched')}
              />
            </div>
            <div>
              <label className="label">{t('বিবরণ', 'Description')}</label>
              <textarea
                className="input min-h-[90px] resize-y"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('বিস্তারিত লিখুন...', 'Write details...')}
              />
            </div>
            <button
              onClick={publish}
              disabled={saving}
              className="brand-btn w-full py-2.5"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {t('প্রকাশ করুন', 'Publish')}
            </button>
          </div>
        </div>
      )}

      {notices.length === 0 && !showForm && (
        <Empty text={t("কোনো নোটিশ নেই। 'নতুন নোটিশ' বাটনে ট্যাপ করে একটি যোগ করুন।", "No notices yet. Tap 'New Notice' to add one.")} />
      )}

      <div className="space-y-3">
        {notices.map((n) => (
          <div
            key={n.id}
            className={cn(
              'rounded-2xl bg-white p-4 ring-1',
              n.active ? 'ring-violet-200' : 'ring-slate-200 opacity-70'
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                n.active ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'
              )}>
                <Megaphone size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-slate-800">{n.title}</p>
                  <span className={cn(
                    'badge text-[10px]',
                    n.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  )}>
                    {n.active ? t('সক্রিয়', 'Active') : t('লুকানো', 'Hidden')}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{n.body}</p>
                <p className="mt-2 text-[10px] text-slate-400">{timeAgo(new Date(n.created_at).getTime())}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => toggle(n)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold active:scale-95',
                  n.active ? 'bg-slate-100 text-slate-600' : 'bg-emerald-600 text-white'
                )}
              >
                {n.active ? <><EyeOff size={14} /> {t('লুকান', 'Hide')}</> : <><Eye size={14} /> {t('সক্রিয় করুন', 'Activate')}</>}
              </button>
              <button
                onClick={() => remove(n.id)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 active:scale-95"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} tone="success" />}
    </div>
  );
}

// ---------- shared ----------
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-rose-100 text-rose-700',
  };
  return <span className={cn('badge', map[status] ?? 'bg-slate-100 text-slate-600')}>{status}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 ring-1 ring-slate-200">{text}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 animate-pop" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
