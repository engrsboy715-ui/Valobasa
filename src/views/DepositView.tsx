import { useEffect, useState } from 'react';
import { bdt, bdtPlain, timeAgo } from '@/lib/format';
import type { DepositMethod } from '@/types';
import { CopyButton, Toast, copyText } from '@/components/ui';
import { UploadBox } from '@/views/CreateView';
import { createDeposit, fetchMyDeposits, type DepositRow, type Profile } from '@/lib/supabase';
import { useLanguage } from '@/lib/LanguageContext';
import { cn } from '@/lib/cn';
import { CASH_OUT_RATE_PER_1000, cashOutCharge } from '@/lib/paymentRates';
import { BkashLogo, NagadLogo, RocketLogo, UpayLogo } from '@/components/BrandLogos';
import {
  ChevronLeft, PlayCircle, History, Check, Clock, X, ShieldCheck,
} from 'lucide-react';
import type { JSX } from 'react';

// Rocket uses a different receive number; all others share one
const PRIMARY_NUMBER = '01322490870';
const ROCKET_NUMBER = '01984430576';

const METHOD_NUMBERS: Record<DepositMethod, string> = {
  'bKash Personal': PRIMARY_NUMBER,
  'Nagad Personal': PRIMARY_NUMBER,
  'Rocket Personal': ROCKET_NUMBER,
  'Upay Personal': PRIMARY_NUMBER,
};

const METHODS: {
  name: DepositMethod;
  Logo: (props: { className?: string }) => JSX.Element;
}[] = [
  { name: 'bKash Personal', Logo: BkashLogo },
  { name: 'Nagad Personal', Logo: NagadLogo },
  { name: 'Rocket Personal', Logo: RocketLogo },
  { name: 'Upay Personal', Logo: UpayLogo },
];

const QUICK = [50, 100, 500, 1000, 2000, 5000];

export function DepositView({ onBack, profile }: { onBack: () => void; profile: Profile | null }) {
  const { t } = useLanguage();
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<DepositMethod>('bKash Personal');
  const [sender, setSender] = useState('');
  const [trxId, setTrxId] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [numCopied, setNumCopied] = useState(false);

  useEffect(() => {
    if (showHistory) fetchMyDeposits().then(setDeposits);
  }, [showHistory]);

  const active = METHODS.find((m) => m.name === method)!;
  const receiveNumber = METHOD_NUMBERS[method];
  const cashOutRate = CASH_OUT_RATE_PER_1000[method];

  const depositAmount = parseFloat(amount) || 0;
  const cashOutChargeVal = cashOutCharge(depositAmount, method);
  const totalToSend = depositAmount + cashOutChargeVal;

  const copyNumber = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyText(receiveNumber);
    if (ok) {
      setNumCopied(true);
      setToast(t('নম্বর কপি হয়েছে!', 'Number copied!'));
      setTimeout(() => setNumCopied(false), 1500);
    } else {
      setToast(t('কপি করা যায়নি। ম্যানুয়ালি কপি করুন।', 'Could not copy. Please copy manually.'));
    }
  };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setToast(t('সঠিক টাকার পরিমাণ লিখুন।', 'Please enter a valid amount.'));
    if (!sender.trim()) return setToast(t('যে নম্বর থেকে টাকা পাঠিয়েছেন তা লিখুন।', 'Please enter the number you sent money from.'));
    if (!trxId.trim()) return setToast(t('ট্রানজেকশন আইডি (TrxID) লিখুন।', 'Please enter the Transaction ID (TrxID).'));
    if (!screenshot) return setToast(t('পেমেন্টের স্ক্রিনশট আপলোড করুন।', 'Please upload the payment screenshot.'));
    const res = await createDeposit({
      amount: amt,
      method,
      sender_number: sender.trim(),
      trx_id: trxId.trim(),
      screenshot,
      user_name: profile?.full_name || profile?.email || '',
    });
    if (res.success) {
      setAmount(''); setSender(''); setTrxId(''); setScreenshot('');
    }
    setToast(res.success ? t('ডিপোজিট রিকোয়েস্ট পাঠানো হয়েছে! অ্যাডমিন অনুমোদনের অপেক্ষায়।', 'Deposit request sent! Awaiting admin approval.') : res.message);
  };

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur-md">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-800">{t('টাকা জমা দিন (ডিপোজিট)', 'Deposit Money')}</h1>
        <button
          onClick={() => setShowHistory(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700"
        >
          <History size={14} /> {t('হিস্টোরি', 'History')}
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* Tutorial card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-md">
          <div className="flex items-center gap-3">
            <PlayCircle size={36} className="text-violet-400" />
            <div className="flex-1">
              <p className="text-sm font-bold">{t('কিভাবে ডিপোজিট করবেন', 'How to Deposit')}</p>
              <p className="text-xs text-slate-300">{t('২ মিনিটের টিউটোরিয়াল ভিডিও দেখুন', 'Watch the 2-minute tutorial video')}</p>
            </div>
            <span className="badge bg-violet-500/30 text-violet-200">২:০০</span>
          </div>
        </div>

        {/* Amount */}
        <div className="card">
          <label className="label">{t('টাকার পরিমাণ (BDT)', 'Amount (BDT)')}</label>
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
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(String(q))}
                className={cn(
                  'pill',
                  amount === String(q) ? 'bg-violet-600 text-white ring-violet-600' : 'bg-violet-50 text-violet-700 ring-violet-200'
                )}
              >
                ৳{q}
              </button>
            ))}
          </div>
        </div>

        {/* Payment method */}
        <div className="card">
          <label className="label">{t('পেমেন্ট মেথড', 'Payment Method')}</label>
          <div className="space-y-2">
            {METHODS.map((m) => (
              <button
                key={m.name}
                onClick={() => setMethod(m.name)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border p-3 transition',
                  method === m.name ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-200' : 'border-slate-200 bg-white'
                )}
              >
                <m.Logo className="h-9 w-9 shrink-0 rounded-lg" />
                <span className="flex-1 text-left text-sm font-semibold text-slate-800">{m.name}</span>
                {method === m.name && <Check size={18} className="text-violet-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* Cash-out charge breakdown */}
        {depositAmount > 0 && (
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">{t('ক্যাশ-আউট চার্জ বিবরণ', 'Cash-out Charge Details')}</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">{t('আপনার ডিপোজিট অ্যামাউন্ট', 'Your Deposit Amount')}</span>
                <span className="font-semibold text-slate-800">৳{bdtPlain(depositAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">
                  {t(`ক্যাশ-আউট চার্জ (${method.replace(' Personal', '')} · ৳${cashOutRate}/1000)`, `Cash-out charge (${method.replace(' Personal', '')} · ৳${cashOutRate}/1000)`)}
                </span>
                <span className="font-semibold text-rose-600">+৳{bdtPlain(cashOutChargeVal)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2.5">
                <span className="font-bold text-slate-700">{t('সেন্ড মানি করতে হবে (মোট)', 'Total to Send Money')}</span>
                <span className="text-base font-extrabold text-violet-700">৳{bdtPlain(totalToSend)}</span>
              </div>
            </div>
            <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
              {t(`মোট ৳${bdtPlain(totalToSend)} টাকা সেন্ড মানি করুন। ক্যাশ-আউট চার্জ সহ এই পরিমাণ পাঠালে আপনার ওয়ালেটে ৳${bdtPlain(depositAmount)} ক্রেডিট হবে।`, `Send ৳${bdtPlain(totalToSend)} in total. Sending this amount including the cash-out charge will credit ৳${bdtPlain(depositAmount)} to your wallet.`)}
            </p>
          </div>
        )}

        {/* Deposit form */}
        <div className="card space-y-4">
          <p className="text-sm font-bold text-slate-800">{t('পেমেন্টের বিবরণ', 'Payment Details')}</p>

          <div>
            <label className="label">{t(`আমাদের পার্সোনাল নম্বর (${receiveNumber})`, `Our Personal Number (${receiveNumber})`)}</label>
            <button
              type="button"
              onClick={copyNumber}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-3 transition active:scale-[0.99]',
                numCopied ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'bg-slate-100 hover:bg-slate-200/80'
              )}
              aria-label="Tap to copy number"
            >
              <span className="flex items-center gap-2">
                <active.Logo className="h-6 w-6 rounded-md" />
                <span className="font-mono text-sm font-semibold text-slate-800 select-none">{receiveNumber}</span>
              </span>
              <CopyButton text={receiveNumber} label={numCopied ? t('Copied!', 'Copied!') : t('কপি', 'Copy')} />
            </button>
            <p className="mt-1.5 text-xs text-slate-500">
              {method === 'Rocket Personal'
                ? t('Rocket এর জন্য আলাদা নম্বর। নম্বরে ট্যাপ করে কপি করুন।', 'Separate number for Rocket. Tap the number to copy.')
                : t('নম্বরে ট্যাপ করে বা "কপি" বাটনে চাপ দিয়ে কপি করুন। তারপর টাকা পাঠিয়ে TrxID ও স্ক্রিনশট নিচে দিন।', 'Tap the number or press the Copy button to copy it. Then send the money and enter the TrxID and screenshot below.')}
            </p>
          </div>

          <div>
            <label className="label">{t('যে নম্বর থেকে টাকা পাঠিয়েছেন (সেন্ডার নম্বর)', 'Sender Number (your number)')}</label>
            <input className="input" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="01XXXXXXXXX" />
          </div>

          <div>
            <label className="label">{t('ট্রানজেকশন আইডি (TrxID)', 'Transaction ID (TrxID)')}</label>
            <input className="input" value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder={t('যেমন: 8AB12CD34E', 'e.g. 8AB12CD34E')} />
          </div>

          <div>
            <label className="label">{t('পেমেন্টের স্ক্রিনশট আপলোড করুন', 'Upload Payment Screenshot')}</label>
            <UploadBox
              value={screenshot}
              onChange={(f) => {
                if (!f) return setScreenshot('');
                const r = new FileReader();
                r.onload = () => setScreenshot(r.result as string);
                r.readAsDataURL(f);
              }}
              onClear={() => setScreenshot('')}
              label={t('পেমেন্টের স্ক্রিনশট আপলোড করুন', 'Upload Payment Screenshot')}
            />
          </div>
        </div>

        <button onClick={submit} className="brand-btn w-full py-3 text-base">
          <ShieldCheck size={18} /> {t('ডিপোজিট রিকোয়েস্ট পাঠান', 'Send Deposit Request')}
        </button>
      </div>

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowHistory(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-t-3xl bg-white animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-bold text-slate-800">{t('আমার ডিপোজিট হিস্টোরি', 'My Deposit History')}</h2>
              <button onClick={() => setShowHistory(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
              {deposits.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-400">{t('এখনো কোনো ডিপোজিট রিকোয়েস্ট নেই।', 'No deposit requests yet.')}</p>
              )}
              {deposits.map((d) => (
                <div key={d.id} className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">{bdt(d.amount)}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{d.method} · TrxID: {d.trx_id}</p>
                  <p className="text-xs text-slate-400">{timeAgo(new Date(d.created_at).getTime())}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} tone={toast.includes('যায়নি') ? 'error' : 'success'} />}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  if (status === 'approved') return <span className="badge bg-emerald-100 text-emerald-700"><Check size={11} /> {t('অনুমোদিত', 'Approved')}</span>;
  if (status === 'rejected') return <span className="badge bg-rose-100 text-rose-700"><X size={11} /> {t('বাতিল', 'Rejected')}</span>;
  return <span className="badge bg-amber-100 text-amber-700"><Clock size={11} /> {t('অপেক্ষমাণ', 'Pending')}</span>;
}
