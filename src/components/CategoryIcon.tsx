import {
  Home,
  Briefcase,
  PlusCircle,
  Wallet,
  User,
  type LucideIcon,
} from 'lucide-react';
import {
  FacebookLogo,
  YouTubeLogo,
  TikTokLogo,
  InstagramLogo,
  FeederAppLogo,
} from '@/components/BrandLogos';

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  Briefcase,
  PlusCircle,
  Wallet,
  User,
};

const BRAND_MAP: Record<string, (props: { className?: string }) => JSX.Element> = {
  Facebook: FacebookLogo,
  Youtube: YouTubeLogo,
  Music2: TikTokLogo,
  Instagram: InstagramLogo,
  Smartphone: FeederAppLogo,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Brand = BRAND_MAP[name];
  if (Brand) return <Brand className={className} />;
  const Icon = ICON_MAP[name] ?? Briefcase;
  return <Icon className={className} />;
}
