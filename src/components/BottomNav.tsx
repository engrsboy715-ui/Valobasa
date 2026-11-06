import { cn } from '@/lib/cn';
import { useLanguage } from '@/lib/LanguageContext';

export type TabKey = 'home' | 'work' | 'create' | 'wallet' | 'profile';

const TABS: { key: TabKey; bn: string; en: string; icon: string }[] = [
  { key: 'home', bn: 'হোম', en: 'Home', icon: 'Home' },
  { key: 'work', bn: 'কাজ', en: 'Tasks', icon: 'Briefcase' },
  { key: 'create', bn: 'তৈরি করুন', en: 'Create', icon: 'PlusCircle' },
  { key: 'wallet', bn: 'ওয়ালেট', en: 'Wallet', icon: 'Wallet' },
  { key: 'profile', bn: 'প্রোফাইল', en: 'Profile', icon: 'User' },
];

import { Home, Briefcase, PlusCircle, Wallet, User } from 'lucide-react';
const ICONS: Record<string, typeof Home> = {
  Home,
  Briefcase,
  PlusCircle,
  Wallet,
  User,
};

export function BottomNav({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  const { t: translate } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
        {TABS.map((t) => {
          const Icon = ICONS[t.icon];
          const isActive = active === t.key;
          const isCreate = t.key === 'create';
          if (isCreate) {
            return (
              <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className="relative -mt-6 flex flex-1 flex-col items-center justify-end pb-1"
              >
                <span
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 text-white shadow-lg shadow-violet-600/30 ring-4 ring-white transition active:scale-95',
                    isActive && 'scale-105'
                  )}
                >
                  <Icon size={24} />
                </span>
                <span className="mt-1 text-[10px] font-semibold text-violet-700">{translate(t.bn, t.en)}</span>
              </button>
            );
          }
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className="flex flex-1 flex-col items-center gap-0.5 py-1.5 transition active:scale-95"
            >
              <Icon
                size={22}
                className={cn(
                  'transition-colors',
                  isActive ? 'text-violet-700' : 'text-slate-400'
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  isActive ? 'text-violet-700' : 'text-slate-400'
                )}
              >
                {translate(t.bn, t.en)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
