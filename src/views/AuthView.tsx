import { useState } from 'react';
import { supabase, applyReferralCode } from '@/lib/supabase';
import { FeederAppLogo } from '@/components/BrandLogos';
import { Toast } from '@/components/ui';
import { Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2, Gift } from 'lucide-react';

type Mode = 'login' | 'signup';

function friendlyAuthError(msg: string): string {
  if (msg.includes('User already registered')) return 'An account with this email already exists. Please log in.';
  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (msg.includes('Password should be at least')) return 'Password must be at least 6 characters.';
  if (msg.includes('Unable to validate email address')) return 'Please enter a valid email address.';
  return msg;
}

export function AuthView() {
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const validate = (): string | null => {
    if (mode === 'signup' && name.trim().length < 2) return 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      setToast({ msg: err, ok: false });
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (error) {
          setToast({ msg: friendlyAuthError(error.message), ok: false });
          setBusy(false);
          return;
        }
        const uid = data.user?.id;
        if (uid) {
          if (referralCode.trim()) {
            await applyReferralCode(referralCode.trim(), uid);
          }
        }
        // onAuthStateChange in useAuth will pick up the new session
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setToast({ msg: friendlyAuthError(error.message), ok: false });
          setBusy(false);
          return;
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setToast({ msg: friendlyAuthError(msg), ok: false });
      setBusy(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setToast(null);
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-gradient-to-br from-slate-50 via-emerald-50/40 to-teal-50">
      <div className="flex min-h-screen flex-col px-6 py-10">
        {/* Brand */}
        <div className="flex flex-col items-center pt-6">
          <FeederAppLogo className="h-14 w-14" />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === 'signup'
              ? 'Sign up to start earning from micro tasks.'
              : 'Log in to continue to your dashboard.'}
          </p>
        </div>

        {/* Form */}
        <div className="mt-8 space-y-4">
          {mode === 'signup' && (
            <Field
              icon={<UserIcon size={18} className="text-slate-400" />}
              label="Full Name"
            >
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
              />
            </Field>
          )}

          <Field icon={<Mail size={18} className="text-slate-400" />} label="Email Address">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
            />
          </Field>

          <Field icon={<Lock size={18} className="text-slate-400" />} label="Password">
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="text-slate-400 transition hover:text-slate-600"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </Field>

          {mode === 'signup' && (
            <Field
              icon={<Gift size={18} className="text-slate-400" />}
              label="Referral Code (optional)"
            >
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="Enter a friend's code for 100 bonus coins"
                className="w-full bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
              />
            </Field>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition active:scale-[0.98] disabled:opacity-70"
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" />
            ) : mode === 'signup' ? (
              'Sign Up'
            ) : (
              'Log In'
            )}
          </button>
        </div>

        {/* Toggle */}
        <p className="mt-6 text-center text-sm text-slate-500">
          {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
            className="font-bold text-emerald-600 transition hover:text-emerald-700"
          >
            {mode === 'signup' ? 'Log In' : 'Sign Up'}
          </button>
        </p>

        <p className="mt-auto pt-8 text-center text-xs text-slate-400">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>

      {toast && (
        <Toast message={toast.msg} onClose={() => setToast(null)} tone={toast.ok ? 'success' : 'error'} />
      )}
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
        {icon}
        {children}
      </div>
    </label>
  );
}
