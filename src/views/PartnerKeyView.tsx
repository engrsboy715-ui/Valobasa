import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Clock, Copy, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { APP_SETTINGS } from '@/lib/appSettings';
import { applyForPartnerKey, fetchMyPartnerKey, type PartnerKey, type Profile } from '@/lib/supabase';
import { bdtPlain } from '@/lib/format';
import { Toast, copyText } from '@/components/ui';
import { PkBadge } from '@/components/PkBadge';

export function PartnerKeyView({ onBack, profile }: { onBack: () => void; profile: Profile | null }) {
  const [partnerKey, setPartnerKey] = useState<PartnerKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const fee = APP_SETTINGS.partnerKeyFee;
  const balance = profile?.balance ?? 0;
  const hasEnoughBalance = balance >= fee;

  const loadKey = async () => {
    setLoading(true);
    try {
      setPartnerKey(await fetchMyPartnerKey());
      setLoadError('');
    } catch {
      setLoadError('Could not load your Partner Key status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKey();
  }, []);

  const apply = async () => {
    if (!hasEnoughBalance) {
      setToast({ msg: `A minimum balance of ৳${bdtPlain(fee)} is required to apply for a Partner Key.`, ok: false });
      return;
    }
    setSubmitting(true);
    const res = await applyForPartnerKey();
    setSubmitting(false);
    setToast({ msg: res.message, ok: res.success });
    if (res.success) await loadKey();
  };

  const copyCode = async () => {
    if (!partnerKey?.code) return;
    const ok = await copyText(partnerKey.code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setToast({ msg: 'Could not copy the code. Please copy it manually.', ok: false });
    }
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
        </div>
      );
    }
    if (loadError) {
      return (
        <div className="flex items-start gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />
          <p className="text-sm font-medium text-rose-700">{loadError}</p>
        </div>
      );
    }
    if (partnerKey?.status === 'approved' && partnerKey.code) {
      return (
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg">
            <div className="flex items-center gap-2">
              <PkBadge className="px-2 py-1 text-xs" />
              <p className="text-sm font-semibold text-slate-200">Your Partner Key is active</p>
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Partner code</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="font-mono text-2xl font-extrabold tracking-widest">{partnerKey.code}</p>
              <button
                onClick={copyCode}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold text-white transition active:scale-95"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="card space-y-2 text-sm text-slate-600">
            <p>Share this code with the people who post tasks. When they use it, their service charge is {APP_SETTINGS.partnerServiceChargePercent}% instead of {APP_SETTINGS.serviceChargePercent}%.</p>
            <p>You earn {APP_SETTINGS.partnerCommissionPercent}% of each task's subtotal, credited straight to your balance.</p>
          </div>
        </div>
      );
    }
    if (partnerKey?.status === 'pending') {
      return (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <Clock size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-bold text-amber-900">Application under review</p>
            <p className="mt-1 text-sm text-amber-800">An admin will review your Partner Key application soon. Your balance is checked again at approval.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {partnerKey?.status === 'rejected' && (
          <div className="flex items-start gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-200">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />
            <p className="text-sm font-medium text-rose-700">Your last application was not approved. You can apply again.</p>
          </div>
        )}
        <div className="card space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <KeyRound size={20} />
          </div>
          <p className="text-base font-bold text-slate-900">Become a Partner</p>
          <p className="text-sm text-slate-600">
            Get your own partner code. When someone posts a task with it, you earn {APP_SETTINGS.partnerCommissionPercent}% of the task subtotal in your balance.
            A one-time fee of ৳{bdtPlain(fee)} is deducted when your application is approved.
          </p>
        </div>
        <div className={`flex items-center justify-between rounded-2xl p-3.5 ring-1 ${hasEnoughBalance ? 'bg-emerald-50 ring-emerald-200' : 'bg-rose-50 ring-rose-200'}`}>
          <span className={`text-sm font-medium ${hasEnoughBalance ? 'text-emerald-800' : 'text-rose-700'}`}>
            {hasEnoughBalance ? 'Your balance is enough to apply' : `You need ৳${bdtPlain(fee - balance)} more to apply`}
          </span>
          <span className="text-sm font-bold text-slate-800">৳ {bdtPlain(balance)}</span>
        </div>
        <button onClick={apply} disabled={submitting} className="brand-btn w-full py-3 text-base">
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
          Apply for Partner Key
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-white px-4 py-4 shadow-sm">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition active:scale-90"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-slate-900">Partner Key</h1>
      </header>

      <div className="px-4 py-5">{renderBody()}</div>

      {toast && <Toast message={toast.msg} onClose={() => setToast(null)} tone={toast.ok ? 'success' : 'error'} />}
    </div>
  );
}
