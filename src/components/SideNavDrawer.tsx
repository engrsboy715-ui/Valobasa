import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { useLanguage } from '@/lib/LanguageContext';
import type { Profile } from '@/lib/supabase';
import {
  X,
  UserRound,
  ShieldCheck,
  Gift,
  Share2,
  Star,
  MessageCircle,
  FileText,
  Info,
  ChevronRight,
} from 'lucide-react';

export type SideMenuDestination =
  | 'referral'
  | 'verification'
  | 'share'
  | 'rate'
  | 'support'
  | 'terms'
  | 'privacy'
  | 'about'
  | 'profile';

interface Props {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  onNavigate: (dest: SideMenuDestination) => void;
}

export function SideNavDrawer({ open, onClose, profile, onNavigate }: Props) {
  const [animClass, setAnimClass] = useState('translate-x-[-100%]');

  useEffect(() => {
    if (open) {
      setAnimClass('translate-x-0');
    } else {
      setAnimClass('translate-x-[-100%]');
    }
  }, [open]);

  const { t: translate } = useLanguage();
  const menuItems: { key: SideMenuDestination; label: string; hint: string; icon: typeof UserRound }[] = [
    { key: 'referral', label: translate('Referral & Earn', 'Referral & Earn'), icon: Gift, hint: translate('Invite friends, earn coins', 'Invite friends, earn coins') },
    { key: 'verification', label: translate('Identity Verification', 'Identity Verification'), icon: ShieldCheck, hint: translate('Complete your KYC', 'Complete your KYC') },
    { key: 'share', label: translate('Share App', 'Share App'), icon: Share2, hint: translate('Spread the word', 'Spread the word') },
    { key: 'rate', label: translate('Rate Us', 'Rate Us'), icon: Star, hint: translate('Leave feedback', 'Leave feedback') },
    { key: 'support', label: translate('Contact & Support', 'Contact & Support'), icon: MessageCircle, hint: translate('Live chat with us', 'Live chat with us') },
    { key: 'terms', label: translate('Terms of Service', 'Terms of Service'), icon: FileText, hint: translate('Read the terms', 'Read the terms') },
    { key: 'privacy', label: translate('Privacy Policy', 'Privacy Policy'), icon: FileText, hint: translate('How we handle data', 'How we handle data') },
    { key: 'about', label: translate('About App', 'About App'), icon: Info, hint: translate('App info & version', 'App info & version') },
  ];

  const go = (dest: SideMenuDestination) => {
    onClose();
    setTimeout(() => onNavigate(dest), 180);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-[84%] max-w-xs flex-col bg-white shadow-2xl transition-transform duration-300 ease-out',
          animClass
        )}
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 to-violet-900 px-5 pb-5 pt-6 text-white">
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition active:scale-90"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-extrabold ring-2 ring-white/30">
              {(profile?.full_name ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight">{profile?.full_name ?? 'User'}</p>
              <p className="truncate text-xs text-violet-200">{profile?.email ?? ''}</p>
            </div>
          </div>
          {profile?.kyc_status && profile.kyc_status !== 'none' && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
              <ShieldCheck size={13} />
              {profile.kyc_status === 'verified' ? 'Verified' : profile.kyc_status === 'pending' ? 'Verification Pending' : 'Verification Rejected'}
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <button
            onClick={() => go('profile')}
            className="mb-2 flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 text-left transition active:scale-[0.98] hover:bg-violet-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <UserRound size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-slate-800">{translate('My Profile', 'My Profile')}</span>
              <span className="block text-xs text-slate-500">{translate('View your account details', 'View your account details')}</span>
            </span>
            <ChevronRight size={18} className="text-slate-400" />
          </button>

          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => go(item.key)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition active:scale-[0.98] hover:bg-slate-50"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <Icon size={18} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
                  <span className="block text-xs text-slate-400">{item.hint}</span>
                </span>
                <ChevronRight size={18} className="text-slate-300" />
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 px-5 py-3 text-center text-xs text-slate-400">
          ET Work BD · v1.0.0
        </div>
      </aside>
    </>
  );
}
