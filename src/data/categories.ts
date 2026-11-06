import type { Platform } from '@/types';

export interface CategoryMeta {
  platform: Platform;
  icon: string; // lucide name
  color: string; // tailwind gradient classes
  accent: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { platform: 'Facebook', icon: 'Facebook', color: 'from-blue-500 to-blue-700', accent: '#1877F2' },
  { platform: 'YouTube', icon: 'Youtube', color: 'from-red-500 to-red-700', accent: '#FF0000' },
  { platform: 'TikTok', icon: 'Music2', color: 'from-slate-800 to-slate-950', accent: '#000000' },
  { platform: 'Instagram', icon: 'Instagram', color: 'from-fuchsia-500 via-pink-500 to-amber-500', accent: '#E1306C' },
  { platform: 'Feeder App', icon: 'Smartphone', color: 'from-emerald-500 to-teal-700', accent: '#10B981' },
];

export interface SubTask {
  label: string;
  rate: number; // recommended default reward in BDT
}

export const SUB_TASKS: Record<Platform, SubTask[]> = {
  Facebook: [
    { label: 'Facebook Page Follower By Search', rate: 0.25 },
    { label: 'Facebook Post Like, Comment & Share', rate: 0.4 },
    { label: 'Facebook Video 3 Min Watch Time, Like, Comment & Share', rate: 0.75 },
    { label: 'Facebook Video 1 Min Watch Time, Like, Comment & Share', rate: 0.5 },
    { label: 'FB Post Love React and Comment', rate: 0.35 },
    { label: 'Facebook Post Like & Comment', rate: 0.3 },
  ],
  YouTube: [
    { label: 'YouTube Channel Subscribe By Search', rate: 0.5 },
    { label: 'YouTube Video Like, Comment & Share', rate: 0.4 },
    { label: 'YouTube Video 3 Min Watch Time, Like & Comment', rate: 0.7 },
    { label: 'YouTube Video 1 Min Watch Time, Like & Comment', rate: 0.45 },
    { label: 'YouTube Short Video Watch, Like & Comment', rate: 0.3 },
    { label: 'YouTube Full Video Watch, Like & Subscribe', rate: 0.8 },
  ],
  TikTok: [
    { label: 'TikTok Profile Follow', rate: 0.3 },
    { label: 'TikTok Video Like & Comment', rate: 0.3 },
    { label: 'TikTok Video Full Watch, Like & Comment', rate: 0.5 },
    { label: 'TikTok Video Share & Favorite', rate: 0.35 },
    { label: 'TikTok Video Like, Comment & Share', rate: 0.45 },
    { label: 'TikTok Account Follow & 3 Videos Like', rate: 0.6 },
  ],
  Instagram: [
    { label: 'Instagram Profile Follow', rate: 0.4 },
    { label: 'Instagram Post Like & Comment', rate: 0.35 },
    { label: 'Instagram Reel Watch, Like & Comment', rate: 0.5 },
    { label: 'Instagram Story View & Like', rate: 0.25 },
    { label: 'Instagram Post Love React & Share', rate: 0.4 },
    { label: 'Instagram Post Like, Comment & Save', rate: 0.45 },
  ],
  'Feeder App': [
    { label: 'Feeder Page Follower By Search', rate: 0.25 },
    { label: 'Feeder Post Like, Comment & Share', rate: 0.4 },
    { label: 'Feeder Video 3 Min Watch Time, Like, Comment & Share', rate: 0.75 },
    { label: 'Feeder Video 1 Min Watch Time, Like, Comment & Share', rate: 0.5 },
    { label: 'Feeder Post Love React and Comment', rate: 0.35 },
    { label: 'Feeder Post Like & Comment', rate: 0.3 },
  ],
};

export const LEVEL_MULTIPLIER: Record<string, number> = {
  'Level 1': 1,
  'Level 2': 1.5,
  'Level 3': 2,
};

export function rateForLevel(baseRate: number, level: string): number {
  const mult = LEVEL_MULTIPLIER[level] ?? 1;
  return Math.round(baseRate * mult * 100) / 100;
}

const COMMENT_KEYWORDS = ['comment', 'like', 'share', 'react', 'love', 'save'];

export function subTaskNeedsComments(label: string): boolean {
  const lower = label.toLowerCase();
  return COMMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

export const PLATFORM_NAME_LABEL: Record<Platform, { bn: string; en: string; placeholderBn: string; placeholderEn: string }> = {
  Facebook: {
    bn: 'পেজ / প্রোফাইলের নাম',
    en: 'Page / Profile Name',
    placeholderBn: 'যেমন: টেক্সট বক্স অনুযায়ী সার্চ নাম',
    placeholderEn: 'e.g. the search name as in the text box',
  },
  YouTube: {
    bn: 'ইউটিউব চ্যানেলের নাম',
    en: 'YouTube Channel Name',
    placeholderBn: 'যেমন: চ্যানেলের নাম লিখুন',
    placeholderEn: 'e.g. enter the channel name',
  },
  TikTok: {
    bn: 'টিকটক আইডি',
    en: 'TikTok ID',
    placeholderBn: 'যেমন: @username আইডি',
    placeholderEn: 'e.g. @username ID',
  },
  Instagram: {
    bn: 'ইনস্টাগ্রাম আইডি',
    en: 'Instagram ID',
    placeholderBn: 'যেমন: @username আইডি',
    placeholderEn: 'e.g. @username ID',
  },
  'Feeder App': {
    bn: 'ফিডার পেজের নাম',
    en: 'Feeder Page Name',
    placeholderBn: 'যেমন: পেজের নাম লিখুন',
    placeholderEn: 'e.g. enter the page name',
  },
};
