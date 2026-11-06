import { useEffect, useState } from 'react';
import { CATEGORIES, SUB_TASKS } from '@/data/categories';
import type { Job, Platform } from '@/types';
import { bdt, timeAgo } from '@/lib/format';
import { CategoryIcon } from '@/components/CategoryIcon';
import { UploadBox } from '@/views/CreateView';
import { CopyButton, Toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { TaskInstructions } from '@/components/TaskInstructions';
import { useLanguage } from '@/lib/LanguageContext';
import { fetchAllJobs, fetchMyDeposits, fetchMyProofs, submitProof, type Profile } from '@/lib/supabase';
import { toJob } from '@/lib/mappers';
import { useJobsRealtime } from '@/lib/useJobsRealtime';
import {
  Zap, ChevronRight, ChevronLeft, Lock, Check, AlertTriangle,
  Clock, BadgeCheck, X, Upload, ArrowDownToLine,
} from 'lucide-react';

type Screen =
  | { name: 'category' }
  | { name: 'subtask'; platform: Platform }
  | { name: 'feed'; platform: Platform; subTask: string }
  | { name: 'details'; job: Job; platform: Platform; subTask: string }
  | { name: 'submit'; job: Job; platform: Platform; subTask: string }
  | { name: 'result'; job: Job; platform: Platform; subTask: string; success: boolean; message: string };

export function WorkView({ profile, onGoDeposit }: { profile: Profile | null; onGoDeposit?: () => void }) {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [hasMinDeposit, setHasMinDeposit] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: 'category' });

  const loadJobs = async () => {
    const [allJobs, myProofs] = await Promise.all([fetchAllJobs(), fetchMyProofs()]);
    const submittedJobIds = new Set(myProofs.map((p) => p.job_id));
    setJobs(
      allJobs
        .filter((r) => r.status === 'Active' && r.user_id !== profile?.id && !submittedJobIds.has(r.id))
        .map(toJob)
    );
  };

  useEffect(() => {
    loadJobs();
    fetchMyDeposits().then((rows) => setHasMinDeposit(rows.some((d) => d.status === 'approved' && d.amount >= 50)));
  }, [profile?.id]);

  useJobsRealtime(() => { void loadJobs(); });

  const jobCountByPlatform = (platform: string) => jobs.filter((j) => j.platform === platform && j.availableSlots > 0).length;

  const go = (s: Screen) => setScreen(s);
  const back = () => {
    setScreen((prev) => {
      if (prev.name === 'subtask') return { name: 'category' };
      if (prev.name === 'feed') return { name: 'subtask', platform: prev.platform };
      if (prev.name === 'details') return { name: 'feed', platform: prev.platform, subTask: prev.subTask };
      if (prev.name === 'submit') return { name: 'details', job: prev.job, platform: prev.platform, subTask: prev.subTask };
      if (prev.name === 'result') return { name: 'feed', platform: prev.platform, subTask: prev.subTask };
      return { name: 'category' };
    });
  };

  const acceptAndGo = (job: Job, platform: Platform, subTask: string) => {
    go({ name: 'submit', job, platform, subTask });
  };

  return (
    <div className="min-h-full">
      {screen.name !== 'category' && (
        <Header
          title={titleFor(screen, t)}
          onBack={back}
        />
      )}
      {screen.name === 'category' && (
        <CategoryScreen
          jobs={jobs}
          jobCountByPlatform={jobCountByPlatform}
          onPick={(p) => {
            if (!hasMinDeposit) {
              alert(t('সর্বনিম্ন আপনি ৫০ টাকা ডিপোজিট করুন', 'Please deposit at least ৳50 to unlock tasks.'));
              return;
            }
            go({ name: 'subtask', platform: p });
          }}
          hasMinDeposit={hasMinDeposit}
          onDeposit={() => onGoDeposit?.()}
        />
      )}
      {screen.name === 'subtask' && (
        <SubTaskScreen platform={screen.platform} jobs={jobs} onPick={(s) => go({ name: 'feed', platform: screen.platform, subTask: s })} />
      )}
      {screen.name === 'feed' && (
        <FeedScreen jobs={jobs.filter((j) => j.platform === screen.platform && j.subTaskType === screen.subTask)} onPick={(job) => go({ name: 'details', job, platform: screen.platform, subTask: screen.subTask })} />
      )}
      {screen.name === 'details' && (
        <DetailsScreen job={screen.job} onAccept={() => acceptAndGo(screen.job, screen.platform, screen.subTask)} />
      )}
      {screen.name === 'submit' && (
        <SubmitScreen
          job={screen.job}
          workerName={profile?.full_name || profile?.email || ''}
          onSubmit={(ok, msg) => {
            if (ok) void loadJobs();
            go({ name: 'result', job: screen.job, platform: screen.platform, subTask: screen.subTask, success: ok, message: msg });
          }}
        />
      )}
      {screen.name === 'result' && (
        <ResultScreen success={screen.success} message={screen.message} onDone={() => go({ name: 'category' })} />
      )}
    </div>
  );
}

function titleFor(s: Screen, t: (bn: string, en: string) => string): string {
  if (s.name === 'subtask') return s.platform;
  if (s.name === 'feed') return s.subTask;
  if (s.name === 'details') return t('কাজের বিবরণ', 'Task Details');
  if (s.name === 'submit') return t('কাজ জমা দিন', 'Submit Task');
  if (s.name === 'result') return t('যাচাইয়ের ফলাফল', 'Verification Result');
  return t('কাজ', 'Tasks');
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur-md">
      <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95">
        <ChevronLeft size={20} />
      </button>
      <h1 className="truncate text-base font-bold text-slate-800">{title}</h1>
    </div>
  );
}

// ---- Category Screen ----
function CategoryScreen({
  jobs, jobCountByPlatform, onPick, hasMinDeposit, onDeposit,
}: {
  jobs: Job[];
  jobCountByPlatform: (p: string) => number;
  onPick: (p: Platform) => void;
  hasMinDeposit: boolean;
  onDeposit?: () => void;
}) {
  const { t } = useLanguage();
  const total = jobs.filter((j) => j.availableSlots > 0).length;
  return (
    <div className="px-4 py-5">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('কাজ', 'Tasks')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('একটি প্ল্যাটফর্ম বেছে নিন এবং আয় শুরু করুন।', 'Choose a platform and start earning.')}</p>
      </div>

      {/* Deposit gate banner */}
      {!hasMinDeposit && (
        <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 p-4 text-white shadow-lg shadow-rose-500/20">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Lock size={22} />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold">{t('কাজ আনলক করতে ডিপোজিট করুন', 'Deposit to Unlock Tasks')}</p>
              <p className="mt-0.5 text-xs text-white/90">{t('সর্বনিম্ন আপনি ৫০ টাকা ডিপোজিট করুন', 'Please deposit at least ৳50 to start earning.')}</p>
            </div>
          </div>
          {onDeposit && (
            <button
              onClick={onDeposit}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-bold text-rose-600 transition active:scale-[0.98]"
            >
              <ArrowDownToLine size={16} /> {t('এখনই ডিপোজিট করুন', 'Deposit Now')}
            </button>
          )}
        </div>
      )}

      {/* Instant work banner */}
      <div className="mb-5 flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 p-4 text-white shadow-md">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 pulse-ring">
          <Zap size={22} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold">{t('ইনস্ট্যান্ট কাজ', 'Instant Tasks')}</p>
          <p className="text-xs text-white/90">{t(`এখনই ${total} টি কাজ পাওয়া যাচ্ছে`, `${total} tasks available now`)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map((c) => {
          const count = jobCountByPlatform(c.platform);
          return (
            <button
              key={c.platform}
              onClick={() => onPick(c.platform)}
              disabled={count === 0}
              className={cn(
                'group flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200/70 shadow-sm transition active:scale-[0.99]',
                count === 0 && 'opacity-60'
              )}
            >
              <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md', c.color)}>
                <CategoryIcon name={c.icon} className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800">{c.platform} {t('কাজ', 'Tasks')}</p>
                <p className={cn('text-sm font-semibold', count > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                  {count > 0 ? t(`${count} টি কাজ পাওয়া যাচ্ছে`, `${count} tasks available`) : t('কোনো কাজ নেই', 'No tasks available')}
                </p>
              </div>
              {!hasMinDeposit ? (
                <Lock size={20} className="shrink-0 text-rose-400" />
              ) : (
                <ChevronRight size={20} className="shrink-0 text-slate-300 group-hover:text-slate-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Sub-Task Screen ----
function SubTaskScreen({ platform, jobs, onPick }: { platform: Platform; jobs: Job[]; onPick: (s: string) => void }) {
  const { t } = useLanguage();
  const subs = SUB_TASKS[platform];
  return (
    <div className="px-4 py-4">
      <p className="mb-3 text-sm text-slate-500">{t('একটি টাস্ক টাইপ নির্বাচন করুন:', 'Select a task type:')}</p>
      <div className="space-y-2.5">
        {subs.map((s) => {
          const match = jobs.find((j) => j.subTaskType === s.label && j.availableSlots > 0);
          const bestRate = match ? bdt(match.rate) : `৳${s.rate.toFixed(2)}`;
          return (
            <button
              key={s.label}
              onClick={() => onPick(s.label)}
              className="flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left ring-1 ring-slate-200/70 shadow-sm transition active:scale-[0.99]"
            >
              <span className="text-sm font-semibold text-slate-800">{s.label}</span>
              {match ? (
                <span className="badge bg-emerald-100 text-emerald-700">{bestRate}</span>
              ) : (
                <span className="badge bg-slate-100 text-slate-500">৳{s.rate.toFixed(2)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Feed Screen ----
function FeedScreen({ jobs, onPick }: { jobs: Job[]; onPick: (j: Job) => void }) {
  const { t } = useLanguage();
  if (jobs.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-slate-500">{t('এই ক্যাটাগরিতে এখনো কোনো কাজ পোস্ট করা হয়নি।', 'No tasks have been posted in this category yet.')}</p>
        <p className="mt-1 text-xs text-slate-400">{t('তৈরি করুন ট্যাব থেকে একটি কাজ তৈরি করে দেখুন।', 'Try creating one from the Create tab.')}</p>
      </div>
    );
  }
  return (
    <div className="space-y-3 px-4 py-4">
      <p className="text-sm text-slate-500">{t(`${jobs.length} টি কাজ পাওয়া যাচ্ছে`, `${jobs.length} tasks available`)}</p>
      {jobs.map((j) => (
        <button
          key={j.id}
          onClick={() => onPick(j)}
          disabled={j.locked || j.availableSlots <= 0}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-slate-200/70 shadow-sm transition active:scale-[0.99]',
            (j.locked || j.availableSlots <= 0) && 'opacity-70'
          )}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700">{j.employerName.charAt(0).toUpperCase() || '?'}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800">{j.jobTitle}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="badge bg-slate-100 text-slate-600">{t(`${j.availableSlots} স্লট খালি`, `${j.availableSlots} slots open`)}</span>
              <span className="badge bg-violet-100 text-violet-700">{j.level}</span>
              {j.locked && (
                <span className="badge bg-slate-200 text-slate-500">
                  <Lock size={11} /> {t('লক করা', 'Locked')}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-extrabold text-emerald-600">{bdt(j.rate)}</p>
            <p className="text-[10px] text-slate-400">{timeAgo(j.createdAt)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---- Details Screen ----
function DetailsScreen({ job, onAccept }: { job: Job; onAccept: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="px-4 py-4">
      {/* timer banner */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-amber-800 ring-1 ring-amber-200">
        <Clock size={18} className="mt-0.5 shrink-0" />
        <p className="text-xs font-medium leading-relaxed">
          {t('সময়সীমা: কাজটি গ্রহণ করার পর ১০ মিনিটের মধ্যে জমা দিতে হবে।', 'Deadline: You must submit within 10 minutes of accepting the task.')}
        </p>
      </div>

      <div className="card space-y-4">
        {/* Work ID */}
        <Row label={t('কাজের আইডি', 'Task ID')}>
          <span className="font-mono text-sm font-semibold text-slate-800">{job.workId}</span>
          <CopyButton text={job.workId} label={t('কপি', 'Copy')} />
        </Row>
        <Row label={t('পেজের নাম', 'Page Name')}>
          <span className="text-sm font-semibold text-slate-800">{job.pageName}</span>
          <CopyButton text={job.pageName} label={t('কপি', 'Copy')} />
        </Row>
        <Row label={t('পুরস্কার', 'Reward')}>
          <span className="font-bold text-emerald-600">{bdt(job.rate)}</span>
        </Row>
        <Row label={t('স্লট', 'Slots')}>
          <span className="text-sm font-semibold text-slate-700">{job.availableSlots} / {job.totalWorkers}</span>
        </Row>
        <Row label={t('লেভেল', 'Level')}>
          <span className="badge bg-violet-100 text-violet-700">{job.level}</span>
        </Row>
        <Row label={t('কর্মীদাতা', 'Employer')}>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">{job.employerName.charAt(0).toUpperCase() || '?'}</div>
            <span className="text-sm text-slate-700">{job.employerName}</span>
          </div>
        </Row>
      </div>

      {/* Reference screenshot */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">{t('কর্মীদাতার নমুনা স্ক্রিনশট', 'Employer Reference Screenshot')}</p>
        <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
          <img src={job.referenceScreenshot} alt="reference" className="w-full" />
        </div>
        {job.pageLink && (
          <a
            href={job.pageLink}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-violet-700"
          >
            {t('রেফারেন্স পেজ খুলুন', 'Open Reference Page')} <ChevronRight size={14} />
          </a>
        )}
      </div>

      <button
        onClick={onAccept}
        disabled={job.locked || job.availableSlots <= 0}
        className="brand-btn mt-5 w-full py-3 text-base"
      >
        {job.locked ? <><Lock size={18} /> {t('লক করা', 'Locked')}</> : <><Check size={18} /> {t('কাজটি গ্রহণ করুন', 'Accept this task')}</>}
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// ---- Submit Screen ----
function SubmitScreen({ job, workerName, onSubmit }: { job: Job; workerName: string; onSubmit: (ok: boolean, msg: string) => void }) {
  const { t } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [proofs, setProofs] = useState<string[]>(['', '', '']);
  const [toast, setToast] = useState<string | null>(null);

  // 10-min timer
  const [secsLeft, setSecsLeft] = useState(600);
  useEffect(() => {
    const t = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(secsLeft / 60)).padStart(2, '0');
  const ss = String(secsLeft % 60).padStart(2, '0');
  const expired = secsLeft === 0;

  const uploadedCount = proofs.filter(Boolean).length;

  const doSubmit = async () => {
    if (expired) {
      onSubmit(false, t('সময় শেষ হয়ে গেছে। কাজটি বাতিল করা হয়েছে।', 'Time is up. The task has been cancelled.'));
      return;
    }
    if (uploadedCount === 0) {
      setToast(t('অনুগ্রহ করে অন্তত একটি প্রমাণের স্ক্রিনশট আপলোড করুন।', 'Please upload at least one proof screenshot.'));
      return;
    }
    const shots = proofs.filter(Boolean);
    setSubmitting(true);
    const res = await submitProof({
      job_id: job.id,
      work_id: job.workId,
      worker_name: workerName,
      screenshot: shots[0],
      screenshots: shots,
      reward: job.rate,
    });
    setSubmitting(false);
    onSubmit(res.success, res.message);
  };

  return (
    <div className="px-4 py-4">
      {/* timer */}
      <div className={cn(
        'mb-4 flex items-center justify-between rounded-xl p-3.5 text-white',
        expired ? 'bg-rose-600' : 'bg-gradient-to-r from-violet-600 to-violet-800'
      )}>
        <span className="flex items-center gap-2 text-sm font-medium">
          <Clock size={18} /> {t('অবশিষ্ট সময়', 'Time Remaining')}
        </span>
        <span className="font-mono text-lg font-bold tabular-nums">{mm}:{ss}</span>
      </div>

      {/* warning */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 text-amber-900 ring-1 ring-amber-200">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <p className="text-xs font-semibold leading-relaxed">{t('⚠️ ভিডিও দেখে কাজ বুঝে কাজ করবেন', '⚠️ Watch the video and understand the task before doing it')}</p>
      </div>

      {/* Dynamic platform-specific instructions */}
      <TaskInstructions platform={job.platform} subTaskType={job.subTaskType} jobComments={job.commentLines} />

      {/* Upload - 3 screenshot boxes */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">{t('প্রমাণের স্ক্রিনশট (মোট ৩টি)', 'Proof Screenshots (Total 3)')}</p>
          <span className={cn(
            'badge text-[10px]',
            uploadedCount === 3 ? 'bg-emerald-100 text-emerald-700' : uploadedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
          )}>
            {uploadedCount}/{t('৩', '3')}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {proofs.map((proof, idx) => (
            <div key={idx}>
              <p className="mb-1 text-center text-[10px] font-semibold text-slate-500">#{idx + 1}</p>
              <SquareUploadBox
                value={proof}
                onChange={(f) => {
                  if (!f) { setProofs((p) => p.map((v, i) => i === idx ? '' : v)); return; }
                  const r = new FileReader();
                  r.onload = () => setProofs((p) => p.map((v, i) => i === idx ? (r.result as string) : v));
                  r.readAsDataURL(f);
                }}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{t('কাজের ধাপ অনুযায়ী ৩টি স্ক্রিনশট আপলোড করুন (অন্তত একটি আবশ্যক)।', 'Upload 3 screenshots according to the task steps (at least one required).')}</p>
      </div>

      <button onClick={doSubmit} disabled={expired || submitting} className="brand-btn mt-5 w-full py-3 text-base disabled:opacity-50">
        <Upload size={18} /> {t('কাজটি সাবমিট করুন', 'Submit Task')}
      </button>
      <button onClick={() => { onSubmit(false, t('কাজ বাতিল করা হয়েছে।', 'Task cancelled.')); }} className="ghost-btn mt-2 w-full">
        {t('বাতিল করুন', 'Cancel')}
      </button>

      {toast && <Toast message={toast} onClose={() => setToast(null)} tone="error" />}
    </div>
  );
}

function SquareUploadBox({ value, onChange }: { value: string; onChange: (file: File | undefined) => void }) {
  const { t } = useLanguage();
  return (
    <label className="relative flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-violet-400 hover:bg-violet-50/50">
      {value ? (
        <>
          <img src={value} alt="preview" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onChange(undefined); }}
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <X size={13} />
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 text-slate-400">
          <Upload size={20} />
          <span className="text-[9px] font-medium">{t('আপলোড', 'Upload')}</span>
        </div>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0])} />
    </label>
  );
}

// ---- Result Screen ----
function ResultScreen({ success, message, onDone }: { success: boolean; message: string; onDone: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className={cn(
        'mb-5 flex h-24 w-24 items-center justify-center rounded-full animate-pop',
        success ? 'bg-emerald-100' : 'bg-rose-100'
      )}>
        {success ? <BadgeCheck size={48} className="text-emerald-600" /> : <X size={48} className="text-rose-600" />}
      </div>
      <h1 className="text-xl font-extrabold text-slate-900">
        {success ? t('প্রমাণ জমা হয়েছে!', 'Proof Submitted!') : t('জমা দিতে ব্যর্থ', 'Submission Failed')}
      </h1>
      <p className="mt-2 max-w-xs text-sm text-slate-600">{message}</p>
      {success && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-amber-700">
          <Clock size={18} /> <span className="text-sm font-semibold">{t('অ্যাডমিন যাচাইয়ের অপেক্ষায়', 'Awaiting admin verification')}</span>
        </div>
      )}
      <button onClick={onDone} className="brand-btn mt-6 px-8">
        <BadgeCheck size={18} /> {t('কাজে ফিরে যান', 'Back to Tasks')}
      </button>
    </div>
  );
}
