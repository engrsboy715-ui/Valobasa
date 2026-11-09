import { useEffect, useState } from 'react';
import { supabase, fetchReferralsAsReferrer, fetchDownloadLink, type Profile, type ReferralRow } from '@/lib/supabase';
import { coinsToBdt, coinsToBdtDisplay, bdt, timeAgo } from '@/lib/format';
import { Toast } from '@/components/ui';
import { CopyButton } from '@/components/ui';
import {
  ChevronLeft,
  Gift,
  Users,
  Coins,
  Wallet,
  Copy,
  Share2,
  MessageCircle,
  Send,
  Check,
  Sparkles,
} from 'lucide-react';

const SHARE_TEXT = 'Join ET Work BD and earn coins from micro tasks! Use my referral code';

export function ReferralView({ onBack, profile }: { onBack: () => void; profile: Profile | null }) {
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);

  const code = profile?.referral_code ?? 'ET------';
  const totalInvited = referrals.length;
  const totalRewardCoins = referrals.reduce((sum, r) => sum + r.referrer_coins, 0);
  const totalRewardBdt = coinsToBdt(totalRewardCoins);

  useEffect(() => {
    fetchReferralsAsReferrals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDownloadLink().then(setDownloadLink);
  }, []);

  const fetchReferralsAsReferrals = async () => {
    setLoading(true);
    const rows = await fetchReferralsAsReferrer();
    setReferrals(rows);
    setLoading(false);
  };

  const shareUrl = downloadLink ?? `https://etworkbd.app/?ref=${code}`;
  const fullShareText = `${SHARE_TEXT} ${code} — ${shareUrl}`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ET Work BD', text: fullShareText, url: shareUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      try {
        await navigator.clipboard.writeText(fullShareText);
        setToast('Share text copied to clipboard!');
      } catch {
        setToast('Copy not supported on this device.');
      }
    }
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(fullShareText)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-800">Referral & Earn</h1>
      </div>

      <div className="space-y-5 px-4 py-5 pb-24">
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-violet-800 to-violet-950 p-5 text-white shadow-lg">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 -left-6 h-24 w-24 rounded-full bg-white/5" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <Gift size={20} className="text-amber-300" />
              <p className="text-sm font-bold">Your Referral Code</p>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 rounded-2xl bg-white/15 px-4 py-3 text-center text-2xl font-extrabold tracking-widest backdrop-blur-sm">
                {code}
              </div>
              <CopyButton
                text={code}
                label="Copy"
                className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-bold text-amber-900 hover:bg-amber-300"
              />
            </div>
            <p className="mt-3 text-xs text-violet-200">
              Share your code. When someone signs up with it and makes their first <span className="font-bold text-amber-300">৳50 deposit</span>, you both get <span className="font-bold text-amber-300">100 Coins (1 BDT)</span> instantly!
            </p>
          </div>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={share} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-4 ring-1 ring-slate-200 transition active:scale-95 hover:bg-slate-50">
            <Share2 size={22} className="text-violet-700" />
            <span className="text-xs font-semibold text-slate-700">Share</span>
          </button>
          <button onClick={shareWhatsApp} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-4 ring-1 ring-slate-200 transition active:scale-95 hover:bg-slate-50">
            <MessageCircle size={22} className="text-green-600" />
            <span className="text-xs font-semibold text-slate-700">WhatsApp</span>
          </button>
          <button
            onClick={() => { navigator.clipboard?.writeText(shareUrl); setToast('Link copied!'); }}
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-4 ring-1 ring-slate-200 transition active:scale-95 hover:bg-slate-50"
          >
            <Copy size={22} className="text-blue-600" />
            <span className="text-xs font-semibold text-slate-700">Copy Link</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={<Users size={18} />} label="Invited" value={`${totalInvited}`} tone="bg-blue-100 text-blue-700" />
          <StatCard icon={<Coins size={18} />} label="Coins Earned" value={`${totalRewardCoins}`} tone="bg-amber-100 text-amber-700" />
          <StatCard icon={<Wallet size={18} />} label="BDT Earned" value={bdt(totalRewardBdt)} tone="bg-emerald-100 text-emerald-700" />
        </div>

        {/* Rules */}
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-violet-600" />
            <h2 className="text-sm font-bold text-slate-800">How Referral Rewards Work</h2>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <span>When User A invites User B, both get <strong>100 Coins</strong> (= <strong>1 BDT</strong>) — awarded when User B makes their first ৳50 deposit.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <span>Conversion: <strong>100 Coins = 1 BDT</strong> (0.01 BDT per coin).</span>
            </li>
            <li className="flex items-start gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <span>Rewards are credited instantly when the new user makes their first ৳50 deposit after signing up with your code.</span>
            </li>
          </ul>
        </div>

        {/* My referrals list */}
        <div>
          <h2 className="mb-3 text-sm font-bold text-slate-700">My Referrals ({referrals.length})</h2>
          {loading ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 ring-1 ring-slate-200">Loading…</div>
          ) : referrals.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 ring-1 ring-slate-200">
              No referrals yet. Share your code to start earning!
            </div>
          ) : (
            <div className="space-y-2.5">
              {referrals.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-slate-200/70">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
                    {(r.referee_name ?? 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{r.referee_name ?? 'New User'}</p>
                    <p className="text-xs text-slate-400">Joined {timeAgo(new Date(r.created_at).getTime())}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-600">+{r.referrer_coins} coins</p>
                    <p className="text-xs text-slate-400">{coinsToBdtDisplay(r.referrer_coins)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} tone="success" />}
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center ring-1 ring-slate-200/70 shadow-sm">
      <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <p className="mt-2 text-base font-extrabold text-slate-900">{value}</p>
      <p className="text-[10px] font-medium text-slate-500">{label}</p>
    </div>
  );
}
