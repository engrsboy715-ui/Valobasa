import { useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { bdt, coinsToBdt, coinsToBdtDisplay } from '@/lib/format';
import type { Profile } from '@/lib/supabase';
import { SideNavDrawer, type SideMenuDestination } from '@/components/SideNavDrawer';
import { NotificationDrawer, useUnreadNoticeCount } from '@/components/NotificationDrawer';
import type { TabKey } from '@/components/BottomNav';
import {
  Bell,
  Briefcase,
  ChevronRight,
  Coins,
  FolderOpen,
  GraduationCap,
  Menu,
  Trophy,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';

interface SideMenuHandler {
  onNavigate: (dest: SideMenuDestination) => void;
}

export function HomeView({
  go,
  userName,
  profile,
  onSideMenuNavigate,
}: {
  go: (t: string) => void;
  userName: string;
  profile: Profile | null;
  onSideMenuNavigate: SideMenuHandler['onNavigate'];
}) {
  const { language, toggleLanguage, t: translate } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = useUnreadNoticeCount();
  const balance = profile?.balance ?? 0;
  const rank = profile?.rank ?? 0;
  const coins = profile?.coins ?? 0;
  const coinBdt = coinsToBdt(coins);

  const goTo = (s: string) => go(s);

  return (
    <div className="min-h-screen bg-white">
      <SideNavDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        profile={profile}
        onNavigate={onSideMenuNavigate}
      />

      <header className="relative border-b border-slate-100 bg-white px-4 pb-4 pt-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-800 transition hover:bg-slate-100 active:scale-95"
            aria-label="Open menu"
          >
            <Menu size={30} strokeWidth={2.2} />
          </button>
          <img src="/assets/images/97428-removebg-preview.png" alt="ET work BD logo" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[18px] font-extrabold leading-tight tracking-tight text-slate-900">ET work BD</h1>
            <p className="truncate text-xs font-medium text-slate-500">{userName}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleLanguage}
              className="text-xs font-bold text-slate-800 transition active:scale-95"
              aria-label="Switch language"
            >
              <span className={language === 'BN' ? 'text-slate-900' : 'text-slate-400'}>BN</span>
              <span className="mx-0.5 text-slate-300">/</span>
              <span className={language === 'EN' ? 'text-slate-900' : 'text-slate-400'}>EN</span>
            </button>
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center text-slate-800 transition active:scale-95"
              aria-label="Notifications"
            >
              <Bell size={24} strokeWidth={1.9} />
              {unreadCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="space-y-5 px-4 pb-6 pt-5">
        <section className="grid grid-cols-[1.08fr_.92fr] overflow-hidden rounded-[24px] bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.09)] ring-1 ring-slate-200/80">
          <div className="flex min-h-[238px] flex-col justify-between rounded-[20px] bg-gradient-to-br from-[#5b32c4] to-[#3f208f] p-4 text-white shadow-lg shadow-violet-900/20">
            <div>
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                  <Wallet size={19} strokeWidth={1.8} />
                </span>
                <p className="pt-0.5 text-sm font-bold leading-5 text-white/90">{translate('Current', 'Current')}<br />{translate('Balance', 'Balance')}</p>
              </div>
              <p className="whitespace-nowrap text-[22px] font-extrabold tracking-tight">{bdt(balance)} <span className="text-xs font-semibold text-white/80">Taka</span></p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-300 text-amber-800 shadow-inner">
                <Coins size={21} />
              </span>
              <div className="leading-tight">
                <p className="text-base font-bold">{coins.toLocaleString()} <span className="text-xs text-white/80">Coins</span></p>
                <p className="text-[11px] font-medium text-amber-200">{coinsToBdtDisplay(coins)} BDT</p>
              </div>
            </div>
          </div>

          <div className="flex min-h-[238px] flex-col justify-between px-3 py-4">
            <div>
              <div className="flex items-center gap-3 text-slate-500">
                <UserRound size={25} strokeWidth={1.8} className="text-emerald-600" />
                <span className="text-sm font-semibold">{translate('Referral', 'Referral')}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <p><span className="text-xl font-bold text-slate-800">{coinsToBdtDisplay(coins)}</span> <span className="text-slate-500">Taka</span></p>
                <p><span className="text-xl font-bold text-slate-800">{coins.toLocaleString()}</span> <span className="text-slate-500">Coins</span></p>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center gap-3 text-slate-500">
                <Trophy size={25} strokeWidth={1.8} className="text-amber-500" />
                <span className="text-sm font-semibold">{translate('User Rank', 'User Rank')}</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{rank > 0 ? `#${rank}` : '#232'}</p>
              <button type="button" onClick={() => go('wallet')} className="mt-1 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800">{translate('View leader', 'View leaderboard')}</button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-900">{translate('অ্যাপ টিউটোরিয়াল', 'App Tutorials')}</h2>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => go('tutorials')}
              className="flex w-full items-center justify-between overflow-hidden rounded-[22px] bg-gradient-to-br from-violet-600 to-violet-800 p-4 text-left text-white shadow-[0_8px_24px_rgba(91,50,196,0.25)] transition hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <span className="flex items-center gap-4">
                <span className="flex h-16 w-16 items-center justify-center rounded-[19px] bg-white/15">
                  <GraduationCap size={30} strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block text-xl font-bold">{translate('অ্যাপ টিউটোরিয়াল দেখুন', 'Watch App Tutorials')}</span>
                  <span className="mt-1 block max-w-[180px] text-sm text-violet-200">{translate('ভিডিও দেখে সহজে কাজ শিখুন', 'Learn tasks easily by watching videos')}</span>
                </span>
              </span>
              <ChevronRight size={30} className="text-white/70" />
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => goTo('my-created')}
                className="flex flex-col items-start gap-2 rounded-2xl bg-white p-4 text-left shadow-[0_6px_18px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <FolderOpen size={22} />
                </span>
                <span className="text-sm font-bold text-slate-900">{translate('আমার দেওয়া কাজ', 'Jobs I Posted')}</span>
                <span className="text-[11px] text-slate-500">{translate('আপনার পোস্ট করা কাজ ও প্রমাণ যাচাই', 'Review jobs you posted and submitted proofs')}</span>
              </button>

              <button
                type="button"
                onClick={() => goTo('my-submissions')}
                className="flex flex-col items-start gap-2 rounded-2xl bg-white p-4 text-left shadow-[0_6px_18px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Briefcase size={22} />
                </span>
                <span className="text-sm font-bold text-slate-900">{translate('আমার করা কাজ', 'My Completed Tasks')}</span>
                <span className="text-[11px] text-slate-500">{translate('আপনার জমা দেওয়া কাজের ফলাফল', 'View the results of your submissions')}</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
    </div>
  );
}
