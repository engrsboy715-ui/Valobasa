import { useEffect, useState } from 'react';
import { bdt, timeAgo, coinsToBdt, coinsToBdtDisplay } from '@/lib/format';
import type { TxnType, DepositMethod } from '@/types';
import { Toast } from '@/components/ui';
import { useLanguage } from '@/lib/LanguageContext';
import { logout } from '@/App';
import { cn } from '@/lib/cn';
import { createWithdrawal, fetchMyTransactions, type Profile, type TransactionRow } from '@/lib/supabase';
import { usePartnerStatus } from '@/lib/usePartnerStatus';
import { PkBadge } from '@/components/PkBadge';
import {
  Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Coins, TrendingUp,
  TrendingDown, AlertCircle, History, Shield, LogOut, X, Loader2,
} from 'lucide-react';
import type { TabKey } from '@/components/BottomNav';

const ADMIN_EMAIL = 'mdesrafil2510@gmail.com';

export function isAdmin(profile: Profile | null, sessionEmail?: string | null): boolean {
  const email = (profile?.email ?? sessionEmail ?? '').toLowerCase().trim();
  return email === ADMIN_EMAIL;
}

const TXN_META: Record<TxnType, { label: string; icon: typeof TrendingUp; tone: string }> = {
  reward: { label: 'Reward', icon: TrendingUp, tone: 'text-emerald-600 bg-emerald-100' },
  deposit: { label: 'Deposit', icon: ArrowDownToLine, tone: 'text-blue-600 bg-blue-100' },
  deposit_rejected: { label: 'Deposit Rejected', icon: AlertCircle, tone: 'text-rose-600 bg-rose-100' },
  withdraw: { label: 'Withdraw', icon: ArrowUpFromLine, tone: 'text-amber-600 bg-amber-100' },
  spend: { label: 'Spend', icon: TrendingDown, tone: 'text-rose-600 bg-rose-100' },
  penalty: { label: 'Penalty', icon: AlertCircle, tone: 'text-rose-600 bg-rose-100' },
  coin: { label: 'Coin', icon: Coins, tone: 'text-amber-600 bg-amber-100' },
};

const METHODS: DepositMethod[] = ['bKash Personal', 'Nagad Personal', 'Rocket Personal', 'Upay Personal'];
const WITHDRAW_QUICK = [50, 100, 500, 1000, 2000, 5000];

export function WalletView({ go, profile }: { go: (t: string) => void; profile: Profile | null }) {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  useEffect(() => {
    fetchMyTransactions().then(setTransactions);
  }, []);
  const liveBalance = profile?.balance ?? 0;
  const liveCoins = profile?.coins ?? 0;

  return (
    <div className="px-4 py-5">
      <h1 className="text-2xl font-extrabold text-slate-900">{t('Wallet', 'Wallet')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('Track your balance and transactions.', 'Track your balance and transactions.')}</p>

      {/* Balance card */}
      <div className="relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-violet-800 to-violet-950 p-5 text-white shadow-lg">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-white/5" />
        <div className="relative">
          <p className="flex items-center gap-1.5 text-xs text-violet-200">
            <WalletIcon size={14} /> {t('Current Balance', 'Current Balance')}
          </p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">{bdt(liveBalance)}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold">
              <Coins size={13} className="text-amber-300" /> {liveCoins.toLocaleString()} {t('Coins', 'Coins')}
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-amber-400/20 px-2.5 py-1 text-xs font-semibold text-amber-200">
              = {coinsToBdtDisplay(liveCoins)} BDT
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={() => go('deposit')} className="brand-btn py-3">
          <ArrowDownToLine size={18} /> {t('Deposit', 'Deposit')}
        </button>
        <button onClick={() => go('withdraw')} className="ghost-btn py-3">
          <ArrowUpFromLine size={18} /> {t('Withdraw', 'Withdraw')}
        </button>
      </div>

      {/* Stats grid */}
      <h2 className="mb-3 mt-6 text-base font-bold text-slate-800">{t('Overview', 'Overview')}</h2>
      <div className="grid grid-cols-2 gap-3">
        <StatBox label={t('Lifetime Earnings', 'Lifetime Earnings')} value={bdt(profile?.lifetime_earnings ?? 0)} icon={<TrendingUp size={16} />} tone="text-emerald-600" />
        <StatBox label={t('Total Deposit', 'Total Deposit')} value={bdt(profile?.total_deposit ?? 0)} icon={<ArrowDownToLine size={16} />} tone="text-blue-600" />
        <StatBox label={t('Total Withdraw', 'Total Withdraw')} value={bdt(profile?.total_withdraw ?? 0)} icon={<ArrowUpFromLine size={16} />} tone="text-amber-600" />
        <StatBox label={t('Total Spend', 'Total Spend')} value={bdt(profile?.total_spend ?? 0)} icon={<TrendingDown size={16} />} tone="text-rose-600" />
        <StatBox label={t('Total Penalty', 'Total Penalty')} value={bdt(profile?.total_penalty ?? 0)} icon={<AlertCircle size={16} />} tone="text-rose-600" />
        <StatBox label={t('Coin Balance', 'Coin Balance')} value={`${liveCoins}`} icon={<Coins size={16} />} tone="text-amber-600" />
        <StatBox label={t('Coins = BDT', 'Coins = BDT')} value={coinsToBdtDisplay(liveCoins)} icon={<WalletIcon size={16} />} tone="text-violet-600" />
      </div>

      {/* Transactions */}
      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">{t('Recent Transactions', 'Recent Transactions')}</h2>
        <History size={18} className="text-slate-400" />
      </div>
      <div className="space-y-2.5">
        {transactions.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 ring-1 ring-slate-200">
            {t('No transactions yet. Complete a work to earn your first reward.', 'No transactions yet. Complete a task to earn your first reward.')}
          </div>
        )}
        {transactions.slice(0, 30).map((t) => {
          const meta = TXN_META[t.type as TxnType];
          const Icon = meta.icon;
          const sign = t.type === 'reward' || t.type === 'deposit' ? '+' : t.type === 'deposit_rejected' ? '' : '−';
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-slate-200/70 shadow-sm">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.tone}`}>
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{t.description}</p>
                <p className="text-xs text-slate-400">{meta.label} · {timeAgo(new Date(t.created_at).getTime())}</p>
              </div>
              <span className={`text-sm font-bold ${t.type === 'reward' || t.type === 'deposit' ? 'text-emerald-600' : t.type === 'deposit_rejected' ? 'text-rose-600' : 'text-slate-700'}`}>
                {sign}{bdt(t.amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatBox({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 shadow-sm">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 ${tone}`}>{icon}</span>
      <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

const SERVICE_CHARGE_PERCENT = 25;
const MIN_WITHDRAW = 50;

export function WithdrawView({ onBack, profile, onChanged }: { onBack: () => void; profile: Profile | null; onChanged: () => Promise<void> }) {
  const { t } = useLanguage();
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<DepositMethod>('bKash Personal');
  const [receiver, setReceiver] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const balance = profile?.balance ?? 0;

  const net = parseFloat(amount) || 0;
  const charge = net * (SERVICE_CHARGE_PERCENT / 100);
  const totalDeducted = net + charge;
  const amountTooLow = net > 0 && net < MIN_WITHDRAW;
  const insufficientBalance = net > 0 && totalDeducted > balance;
  const canSubmit = net >= MIN_WITHDRAW && !insufficientBalance && receiver.trim().length > 0;

  const submit = async () => {
    if (net < MIN_WITHDRAW) {
      return setToast({ msg: t('সর্বনিম্ন উইথড্র অ্যামাউন্ট ৳৫০ হতে হবে।', 'Minimum withdrawal amount must be ৳50.'), ok: false });
    }
    if (insufficientBalance) {
      return setToast({ msg: t(`পর্যাপ্ত ব্যালেন্স নেই! চার্জসহ মোট ৳${totalDeducted.toFixed(2)} টাকা ব্যালেন্সে থাকতে হবে।`, `Insufficient balance! You need at least ৳${totalDeducted.toFixed(2)} including charge.`), ok: false });
    }
    if (!receiver.trim()) return setToast({ msg: t('রিসিভার নম্বর লিখুন।', 'Please enter the receiver number.'), ok: false });
    setSubmitting(true);
    const res = await createWithdrawal({
      amount: net,
      service_charge: charge,
      total_deducted: totalDeducted,
      method,
      receiver_number: receiver.trim(),
      user_name: profile?.full_name || profile?.email || '',
    });
    setSubmitting(false);
    setToast({ msg: res.message, ok: res.success });
    if (res.success) {
      setAmount('');
      setReceiver('');
      await onChanged();
    }
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur-md">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95">
          <ArrowUpFromLine size={18} />
        </button>
        <h1 className="text-base font-bold text-slate-800">{t('টাকা তুলুন (Withdraw)', 'Withdraw Money')}</h1>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-200">
          <p className="text-xs font-medium text-violet-700">{t('Available Balance', 'Available Balance')}</p>
          <p className="text-2xl font-extrabold text-violet-800">{bdt(balance)}</p>
        </div>

        <div className="card">
          <label className="label">{t('যে পরিমাণ পেতে চান (Net Receive)', 'Amount you want to receive (Net)')}</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">৳</span>
            <input
              className="input pl-9 text-lg font-bold"
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">{t('এই পরিমাণই আপনি পাবেন। এর উপর ২৫% সার্ভিস চার্জ যোগ হবে।', 'You will receive exactly this amount. A 25% service charge will be added on top.')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {WITHDRAW_QUICK.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className={cn(
                  'pill',
                  amount === String(q)
                    ? 'bg-violet-600 text-white ring-violet-600'
                    : 'bg-violet-50 text-violet-700 ring-violet-200'
                )}
              >
                ৳{q}
              </button>
            ))}
          </div>
        </div>

        {/* Charge breakdown */}
        {net > 0 && (
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">{t('চার্জ বিবরণ', 'Charge Details')}</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t('Withdrawal Amount (Net Receive)', 'Withdrawal Amount (Net Receive)')}</span>
                <span className="font-semibold text-slate-800">৳{net.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t('Service Charge (25%)', 'Service Charge (25%)')}</span>
                <span className="font-semibold text-rose-600">+৳{charge.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2.5">
                <span className="font-bold text-slate-700">{t('Total Balance Deducted', 'Total Balance Deducted')}</span>
                <span className={cn('text-base font-extrabold', insufficientBalance ? 'text-rose-600' : 'text-violet-700')}>
                  ৳{totalDeducted.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Validation messages */}
        {amountTooLow && (
          <div className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs font-medium text-rose-600 ring-1 ring-rose-200">
            {t('সর্বনিম্ন উইথড্র অ্যামাউন্ট ৳৫০ হতে হবে।', 'Minimum withdrawal amount must be ৳50.')}
          </div>
        )}
        {insufficientBalance && (
          <div className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs font-medium text-rose-600 ring-1 ring-rose-200">
            {t(`পর্যাপ্ত ব্যালেন্স নেই! চার্জসহ মোট ৳${totalDeducted.toFixed(2)} টাকা ব্যালেন্সে থাকতে হবে।`, `Insufficient balance! You need at least ৳${totalDeducted.toFixed(2)} including charge.`)}
          </div>
        )}

        <div className="card">
          <label className="label">{t('Payment Method', 'Payment Method')}</label>
          <div className="space-y-2">
            {METHODS.map((m) => (
              <button key={m} onClick={() => setMethod(m)}
                className={`flex w-full items-center justify-between rounded-xl border p-3 ${method === m ? 'border-violet-500 bg-violet-50' : 'border-slate-200'}`}>
                <span className="text-sm font-semibold text-slate-800">{m}</span>
                {method === m && <span className="h-2 w-2 rounded-full bg-violet-600" />}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <label className="label">{t('Receiver Number', 'Receiver Number')}</label>
          <input className="input" value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="01XXXXXXXXX" />
        </div>
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="brand-btn w-full py-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowUpFromLine size={18} /> {t('উত্তোলনের রিকোয়েস্ট পাঠান', 'Send Withdrawal Request')}
        </button>
      </div>
      {toast && <Toast message={toast.msg} onClose={() => setToast(null)} tone={toast.ok ? 'success' : 'error'} />}
    </div>
  );
}

export function ProfileView({ goAdmin, profile, sessionEmail }: { goAdmin: () => void; profile: Profile | null; sessionEmail?: string | null }) {
  const { t } = useLanguage();
  const displayName = profile?.full_name || profile?.email?.split('@')[0] || sessionEmail?.split('@')[0] || 'User';
  const email = profile?.email ?? sessionEmail ?? '';
  const liveBalance = profile?.balance ?? 0;
  const liveCoins = profile?.coins ?? 0;
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const isPartner = usePartnerStatus(true);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  return (
    <div className="px-4 py-5">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-3xl font-extrabold text-white shadow-lg ring-4 ring-white">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <h1 className="text-xl font-extrabold text-slate-900">{displayName}</h1>
          {isPartner && <PkBadge className="px-2 py-1 text-xs" />}
        </div>
        <p className="text-sm text-slate-500">{email}</p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <MiniStat label={t('Balance', 'Balance')} value={bdt(liveBalance)} />
        <MiniStat label={t('Coins', 'Coins')} value={`${liveCoins}`} />
        <MiniStat label={t('Coins=BDT', 'Coins=BDT')} value={coinsToBdtDisplay(liveCoins)} />
      </div>

      <div className="mt-5 divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-sm">
        <Row2 label={t('Total Deposit', 'Total Deposit')} value={bdt(profile?.total_deposit ?? 0)} />
        <Row2 label={t('Total Withdraw', 'Total Withdraw')} value={bdt(profile?.total_withdraw ?? 0)} />
        <Row2 label={t('Total Spend', 'Total Spend')} value={bdt(profile?.total_spend ?? 0)} />
        <Row2 label={t('Total Penalty', 'Total Penalty')} value={bdt(profile?.total_penalty ?? 0)} />
        <Row2 label={t('Account', 'Account')} value={t('Active', 'Active')} />
      </div>

      {/* Referral code */}
      {profile?.referral_code && (() => {
        const code = profile.referral_code;
        return (
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 p-4 text-white shadow-md">
          <div>
            <p className="text-xs font-medium text-violet-200">Your Referral Code</p>
            <p className="text-xl font-extrabold tracking-widest">{code}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(code);
              setToast('Referral code copied!');
            }}
            className="rounded-xl bg-white/20 px-3 py-2 text-xs font-bold active:scale-95"
          >
            Copy
          </button>
        </div>
        );
      })()}

      {/* Admin toggle — only visible to the designated admin email */}
      {isAdmin(profile, sessionEmail) && (
        <button
          onClick={goAdmin}
          className="mt-6 flex w-full items-center justify-between rounded-2xl bg-slate-900 p-4 text-white shadow-md active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <Shield size={20} className="text-violet-400" />
            <span className="text-left">
              <span className="block text-sm font-bold">{t('Admin Panel', 'Admin Panel')}</span>
              <span className="block text-xs text-slate-300">{t('Manage users, proofs, deposits & settings', 'Manage users, proofs, deposits & settings')}</span>
            </span>
          </span>
          <ArrowUpFromLine size={18} className="rotate-90 text-slate-400" />
        </button>
      )}

      {/* Logout */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-600 shadow-sm transition active:scale-[0.99] disabled:opacity-70"
      >
        {loggingOut ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
        {loggingOut ? t('Logging out…', 'Logging out…') : t('Log Out', 'Log Out')}
      </button>

      {toast && <Toast message={toast} onClose={() => setToast(null)} tone="success" />}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center ring-1 ring-slate-200/70 shadow-sm">
      <p className="text-sm font-bold text-slate-900">{value}</p>
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function Row2({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  );
}
