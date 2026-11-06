import { useState } from 'react';
import { submitRating } from '@/lib/supabase';
import type { Profile } from '@/lib/supabase';
import { Toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  X,
  Star,
  Share2,
  MessageCircle,
  Copy,
  Send,
  Check,
  Shield,
  FileText,
  Info,
  Loader2,
  Heart,
} from 'lucide-react';

export type ModalKind = 'rate' | 'share' | 'terms' | 'privacy' | 'about' | null;

interface Props {
  kind: ModalKind;
  onClose: () => void;
  profile: Profile | null;
}

export function InfoModal({ kind, onClose, profile }: Props) {
  if (!kind) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">{getTitle(kind)}</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
            <X size={16} />
          </button>
        </div>
        {kind === 'rate' && <RateUsBody profile={profile} onClose={onClose} />}
        {kind === 'share' && <ShareAppBody profile={profile} />}
        {kind === 'terms' && <TermsBody />}
        {kind === 'privacy' && <PrivacyBody />}
        {kind === 'about' && <AboutBody />}
      </div>
    </div>
  );
}

function getTitle(kind: ModalKind): string {
  switch (kind) {
    case 'rate': return 'Rate ET Work BD';
    case 'share': return 'Share the App';
    case 'terms': return 'Terms of Service';
    case 'privacy': return 'Privacy Policy';
    case 'about': return 'About ET Work BD';
    default: return '';
  }
}

// ---------- Rate Us ----------
function RateUsBody({ profile, onClose }: { profile: Profile | null; onClose: () => void }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const submit = async () => {
    if (stars < 1) {
      setToast({ msg: 'Please select a star rating.', ok: false });
      return;
    }
    setSubmitting(true);
    const { error } = await submitRating(stars, comment.trim(), profile?.full_name ?? 'User');
    setSubmitting(false);
    if (error) {
      setToast({ msg: 'Could not submit rating. Try again.', ok: false });
      return;
    }
    setSubmitted(true);
    setToast({ msg: 'Thank you for your feedback!', ok: true });
    setTimeout(() => onClose(), 1400);
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <Check size={32} className="text-emerald-600" />
        </div>
        <p className="mt-4 text-lg font-bold text-slate-800">Thank You!</p>
        <p className="mt-1 text-sm text-slate-500">Your {stars}-star rating has been submitted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-slate-500">How would you rate your experience?</p>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setStars(n)}
            className="transition active:scale-90"
          >
            <Star
              size={38}
              className={cn(
                'transition',
                (hover >= n || stars >= n) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
              )}
            />
          </button>
        ))}
      </div>
      {stars > 0 && (
        <p className="text-center text-sm font-semibold text-slate-700">
          {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][stars]}
        </p>
      )}
      <div>
        <label className="label">Comment (optional)</label>
        <textarea
          className="input min-h-[80px]"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us what you think…"
        />
      </div>
      <button onClick={submit} disabled={submitting} className="brand-btn w-full py-3 disabled:opacity-50">
        {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={16} />}
        Submit Rating
      </button>
      {toast && <Toast message={toast.msg} onClose={() => setToast(null)} tone={toast.ok ? 'success' : 'error'} />}
    </div>
  );
}

// ---------- Share App ----------
function ShareAppBody({ profile }: { profile: Profile | null }) {
  const [copied, setCopied] = useState(false);
  const code = profile?.referral_code ?? 'ETWORK';
  const shareUrl = `https://etworkbd.app/?ref=${code}`;
  const fullText = `Check out ET Work BD — earn coins from micro tasks! Use my code ${code}. ${shareUrl}`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ET Work BD', text: fullText, url: shareUrl });
      } catch { /* cancelled */ }
    } else {
      copyLink();
    }
  };

  const copyLink = () => {
    try {
      navigator.clipboard?.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Share ET Work BD with your friends on WhatsApp, Facebook, Telegram and more.</p>
      <div className="rounded-xl bg-slate-50 p-3 text-center text-sm font-mono font-semibold text-slate-700 ring-1 ring-slate-200 break-all">
        {shareUrl}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <ShareBtn onClick={share} icon={<Share2 size={22} className="text-violet-700" />} label="Share" />
        <ShareBtn onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, '_blank')} icon={<MessageCircle size={22} className="text-green-600" />} label="WhatsApp" />
        <ShareBtn onClick={copyLink} icon={copied ? <Check size={22} className="text-emerald-600" /> : <Copy size={22} className="text-blue-600" />} label={copied ? 'Copied' : 'Copy'} />
      </div>
      <button onClick={share} className="brand-btn w-full py-3">
        <Share2 size={18} /> Open Share Sheet
      </button>
    </div>
  );
}

function ShareBtn({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-50 py-4 ring-1 ring-slate-200 transition active:scale-95 hover:bg-slate-100">
      {icon}
      <span className="text-xs font-semibold text-slate-700">{label}</span>
    </button>
  );
}

// ---------- Terms ----------
function TermsBody() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-600">
      <div className="flex items-center gap-2">
        <FileText size={18} className="text-violet-600" />
        <h3 className="text-sm font-bold text-slate-800">Terms of Service</h3>
      </div>
      <p>By using ET Work BD, you agree to the following terms:</p>
      <Section title="1. Eligibility">You must be at least 18 years old and a resident of Bangladesh to use this platform.</Section>
      <Section title="2. Accounts">You are responsible for keeping your account credentials secure. One account per person.</Section>
      <Section title="3. Tasks & Rewards">Workers are rewarded only after admin-approved proof verification. Coin-to-BDT conversion is fixed at 100 Coins = 1 BDT.</Section>
      <Section title="4. Withdrawals">Minimum withdrawal is ৳50. A 25% service charge applies to each withdrawal request. Withdrawals are processed after admin approval.</Section>
      <Section title="5. Prohibited Activity">Creating fake accounts, submitting fraudulent proofs, or abusing the referral system will result in account suspension and forfeiture of balances.</Section>
      <Section title="6. KYC">You must complete identity verification before withdrawing funds. Submitting false documents will lead to permanent ban.</Section>
      <Section title="7. Changes">We reserve the right to update these terms at any time. Continued use after changes constitutes acceptance.</Section>
      <p className="pt-2 text-xs text-slate-400">Last updated: October 2026</p>
    </div>
  );
}

// ---------- Privacy ----------
function PrivacyBody() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-600">
      <div className="flex items-center gap-2">
        <Shield size={18} className="text-violet-600" />
        <h3 className="text-sm font-bold text-slate-800">Privacy Policy</h3>
      </div>
      <p>Your privacy is important to us. This policy explains what we collect and how we use it.</p>
      <Section title="1. Information We Collect">Your name, email, KYC documents (ID images, selfie), and transaction history. Referral data is stored to credit rewards.</Section>
      <Section title="2. How We Use It">To verify identity, process deposits and withdrawals, prevent fraud, and provide support.</Section>
      <Section title="3. Data Storage">All data is stored securely on Supabase-hosted servers with row-level security. KYC documents are accessible only to you and authorized admins.</Section>
      <Section title="4. Sharing">We never sell your data. Information is shared only when required by law or to process payments.</Section>
      <Section title="5. Your Rights">You may request deletion of your account and associated data at any time by contacting support.</Section>
      <Section title="6. Cookies">We use essential cookies to maintain your login session. No third-party tracking cookies are used.</Section>
      <p className="pt-2 text-xs text-slate-400">Last updated: October 2026</p>
    </div>
  );
}

// ---------- About ----------
function AboutBody() {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-600 to-violet-800 text-white shadow-lg">
        <Info size={36} />
      </div>
      <div>
        <h3 className="text-lg font-extrabold text-slate-900">ET Work BD</h3>
        <p className="text-sm text-slate-500">Version 1.0.0</p>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">
        ET Work BD is a micro-task platform where users earn coins by completing social media tasks.
        Convert your coins to Taka (100 Coins = 1 BDT) and withdraw via bKash, Nagad, or Rocket.
      </p>
      <div className="rounded-xl bg-slate-50 p-4 text-left text-sm ring-1 ring-slate-200">
        <Row label="Platform" value="Web & Mobile" />
        <Row label="Currency" value="100 Coins = 1 BDT" />
        <Row label="Min Withdrawal" value="৳50" />
        <Row label="Service Charge" value="25%" />
      </div>
      <div className="flex items-center justify-center gap-1.5 text-sm text-slate-500">
        Made with <Heart size={14} className="fill-rose-500 text-rose-500" /> in Bangladesh
      </div>
      <p className="text-xs text-slate-400">© 2026 ET Work BD. All rights reserved.</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-0.5 text-slate-600">{children}</p>
    </div>
  );
}
