import { cn } from '@/lib/cn';
import { CopyButton } from '@/components/ui';
import { MessageSquare } from 'lucide-react';
import type { Platform } from '@/types';
import { useLanguage } from '@/lib/LanguageContext';

const PLATFORM_STEP1: Record<Platform, string> = {
  Facebook: 'ফেসবুক অ্যাপ খুলুন এবং নির্দিষ্ট পেজ বা প্রোফাইলটি খুঁজে বের করুন।',
  YouTube: 'ইউটিউব অ্যাপ খুলুন এবং নির্দিষ্ট চ্যানেল বা ভিডিওটি খুঁজে বের করুন।',
  TikTok: 'টিকটক অ্যাপ খুলুন এবং নির্দিষ্ট অ্যাকাউন্ট বা ভিডিওটি খুঁজে বের করুন।',
  Instagram: 'ইনস্টাগ্রাম অ্যাপ খুলুন এবং নির্দিষ্ট প্রোফাইল বা পোস্টটি খুঁজে বের করুন।',
  'Feeder App': 'ফিডার অ্যাপ খুলুন এবং নির্দিষ্ট প্রোফাইল বা পোস্টটি খুঁজে বের করুন।',
};

const PLATFORM_STEP1_EN: Record<Platform, string> = {
  Facebook: 'Open the Facebook app and find the specific page or profile.',
  YouTube: 'Open the YouTube app and find the specific channel or video.',
  TikTok: 'Open the TikTok app and find the specific account or video.',
  Instagram: 'Open the Instagram app and find the specific profile or post.',
  'Feeder App': 'Open the Feeder app and find the specific profile or post.',
};

const PLATFORM_TITLE: Record<Platform, string> = {
  Facebook: 'ফেসবুক কাজের নিয়মাবলী:',
  YouTube: 'ইউটিউব কাজের নিয়মাবলী:',
  TikTok: 'টিকটক কাজের নিয়মাবলী:',
  Instagram: 'ইনস্টাগ্রাম কাজের নিয়মাবলী:',
  'Feeder App': 'ফিডার অ্যাপ কাজের নিয়মাবলী:',
};

const PLATFORM_TITLE_EN: Record<Platform, string> = {
  Facebook: 'Facebook Task Rules:',
  YouTube: 'YouTube Task Rules:',
  TikTok: 'TikTok Task Rules:',
  Instagram: 'Instagram Task Rules:',
  'Feeder App': 'Feeder App Task Rules:',
};

const PLATFORM_FALLBACK_COMMENTS: Record<Platform, string[]> = {
  Facebook: ['দারুণ পেজ!', 'খুবই তথ্যবহুল', 'এখন থেকে ফলো করছি'],
  YouTube: ['খুব সুন্দর ভিডিও!', 'অনেক কিছু শিখতে পারলাম', 'পরবর্তী ভিডিওর অপেক্ষায় রইলাম'],
  TikTok: ['অসাধারণ ভিডিও!', 'অনেক মজা পেলাম', 'ফলো করছি'],
  Instagram: ['সুন্দর পোস্ট!', 'খুব ভালো লেগেছে', 'ফলো করছি'],
  'Feeder App': ['দারুণ অ্যাপ!', 'খুব উপকারী', 'রেফার করছি'],
};

const PLATFORM_FALLBACK_COMMENTS_EN: Record<Platform, string[]> = {
  Facebook: ['Great page!', 'Very informative', 'Following now'],
  YouTube: ['Beautiful video!', 'Learned a lot', 'Waiting for the next video'],
  TikTok: ['Amazing video!', 'Had so much fun', 'Following you'],
  Instagram: ['Nice post!', 'Really liked it', 'Following now'],
  'Feeder App': ['Great app!', 'Very useful', 'Referring it'],
};

function deriveStep2(subTaskType: string): string {
  const s = subTaskType.toLowerCase();
  if (s.includes('subscribe')) return 'ইউটিউব চ্যানেল সাবস্ক্রাইব করুন।';
  if (s.includes('follow')) return 'প্রোফাইল বা পেজ ফলো করুন।';
  if (s.includes('download') && s.includes('sign')) return 'অ্যাপ ডাউনলোড করে সাইন আপ সম্পূর্ণ করুন।';
  if (s.includes('watch') && s.includes('like') && s.includes('comment')) return 'ভিডিওটি নির্দিষ্ট সময় পর্যন্ত দেখুন এবং লাইক, কমেন্ট ও শেয়ার করুন।';
  if (s.includes('watch') && s.includes('like')) return 'ভিডিওটি নির্দিষ্ট সময় পর্যন্ত দেখুন এবং লাইক ও কমেন্ট করুন।';
  if (s.includes('watch')) return 'ভিডিওটি নির্দিষ্ট সময় পর্যন্ত দেখুন।';
  if (s.includes('like') && s.includes('comment') && s.includes('share')) return 'পোস্টে লাইক, কমেন্ট ও শেয়ার করুন।';
  if (s.includes('like') && s.includes('comment')) return 'পোস্টে লাইক ও কমেন্ট করুন।';
  if (s.includes('love') && s.includes('comment')) return 'পোস্টে লাভ রিঅ্যাক্ট ও কমেন্ট করুন।';
  if (s.includes('share') && s.includes('favorite')) return 'ভিডিওটি শেয়ার ও ফেভারিট করুন।';
  if (s.includes('share')) return 'পোস্ট বা ভিডিওটি শেয়ার করুন।';
  if (s.includes('like')) return 'পোস্ট বা ভিডিওটি লাইক করুন।';
  if (s.includes('referral')) return 'রেফারেল টাস্ক সম্পূর্ণ করুন।';
  return 'নির্দেশনা অনুযায়ী কাজটি সঠিকভাবে সম্পূর্ণ করুন।';
}

function deriveStep2En(subTaskType: string): string {
  const s = subTaskType.toLowerCase();
  if (s.includes('subscribe')) return 'Subscribe to the YouTube channel.';
  if (s.includes('follow')) return 'Follow the profile or page.';
  if (s.includes('download') && s.includes('sign')) return 'Download the app and complete the sign-up.';
  if (s.includes('watch') && s.includes('like') && s.includes('comment')) return 'Watch the video for the required duration, then like, comment, and share.';
  if (s.includes('watch') && s.includes('like')) return 'Watch the video for the required duration, then like and comment.';
  if (s.includes('watch')) return 'Watch the video for the required duration.';
  if (s.includes('like') && s.includes('comment') && s.includes('share')) return 'Like, comment, and share the post.';
  if (s.includes('like') && s.includes('comment')) return 'Like and comment on the post.';
  if (s.includes('love') && s.includes('comment')) return 'Leave a love reaction and comment on the post.';
  if (s.includes('share') && s.includes('favorite')) return 'Share and favorite the video.';
  if (s.includes('share')) return 'Share the post or video.';
  if (s.includes('like')) return 'Like the post or video.';
  if (s.includes('referral')) return 'Complete the referral task.';
  return 'Complete the task correctly according to the instructions.';
}

export function TaskInstructions({
  platform,
  subTaskType,
  jobComments = [],
}: {
  platform: Platform;
  subTaskType?: string;
  jobComments?: string[];
}) {
  const { t, language } = useLanguage();
  const isEn = language === 'EN';

  const step1 = isEn
    ? (PLATFORM_STEP1_EN[platform] ?? 'Find the specific page or profile.')
    : (PLATFORM_STEP1[platform] ?? 'নির্দিষ্ট পেজ বা প্রোফাইলটি খুঁজে বের করুন।');
  const step2 = subTaskType
    ? (isEn ? deriveStep2En(subTaskType) : deriveStep2(subTaskType))
    : (isEn ? 'Complete the task according to the instructions.' : 'নির্দেশনা অনুযায়ী কাজটি সম্পূর্ণ করুন।');
  const step3 = isEn ? 'Complete the task and take a clear screenshot.' : 'কাজটি সম্পন্ন করে স্পষ্ট স্ক্রিনশট দিন।';
  const title = isEn
    ? (PLATFORM_TITLE_EN[platform] ?? 'Task Rules:')
    : (PLATFORM_TITLE[platform] ?? 'কাজের নিয়মাবলী:');

  const hasEmployerComments = jobComments.length > 0;
  const comments = hasEmployerComments
    ? jobComments
    : (isEn ? (PLATFORM_FALLBACK_COMMENTS_EN[platform] ?? []) : (PLATFORM_FALLBACK_COMMENTS[platform] ?? []));

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-bold text-slate-800">{title}</h3>
      <ol className="mb-4 space-y-2.5">
        {[step1, step2, step3].map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed text-slate-700">{step}</p>
          </li>
        ))}
      </ol>

      {comments.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <MessageSquare size={13} />
            {hasEmployerComments
              ? t('কর্মীদাতা যে কমেন্ট দিয়েছে (কপি করে ব্যবহার করুন):', 'Comments from the employer (copy and use):')
              : t('কমেন্ট করার জন্য নিচের যেকোনো একটি ব্যবহার করুন:', 'Use any of the comments below:')}
          </p>
          <div className="space-y-2">
            {comments.map((comment, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 shadow-sm transition',
                  hasEmployerComments ? 'border-violet-200 bg-violet-50/40' : 'hover:border-violet-200 hover:bg-violet-50'
                )}
              >
                <span className="flex-1">{comment}</span>
                <CopyButton text={comment} label={t('কপি', 'Copy')} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
