import { useEffect, useState } from 'react';
import { CATEGORIES, SUB_TASKS, rateForLevel, subTaskNeedsComments, PLATFORM_NAME_LABEL } from '@/data/categories';
import type { Job, Platform, JobLevel } from '@/types';
import { APP_SETTINGS } from '@/lib/appSettings';
import { toJob } from '@/lib/mappers';
import { useJobsRealtime } from '@/lib/useJobsRealtime';
import { createJob, fetchAllJobs, type Profile } from '@/lib/supabase';
import { bdtPlain } from '@/lib/format';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Toast } from '@/components/ui';
import { useLanguage } from '@/lib/LanguageContext';
import { Check, Link2, Upload, Image as ImageIcon, X, Calculator, MessageSquare } from 'lucide-react';

export function CreateView({ profile, onChanged }: { profile: Profile | null; onChanged: () => Promise<void> }) {
  const { t } = useLanguage();
  const settings = APP_SETTINGS;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadJobs = () => {
    fetchAllJobs().then((rows) => setJobs(rows.map(toJob)));
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useJobsRealtime(loadJobs);

  const jobCountByPlatform = (p: Platform) => jobs.filter((j) => j.platform === p && j.status === 'Active' && j.availableSlots > 0).length;
  const [platform, setPlatform] = useState<Platform>('Facebook');
  const [subTaskType, setSubTaskType] = useState(SUB_TASKS['Facebook'][0].label);
  const [totalWorkers, setTotalWorkers] = useState('');
  const [pageName, setPageName] = useState('');
  const [pageLink, setPageLink] = useState('');
  const [level, setLevel] = useState<JobLevel>('Level 1');
  const [screenshot, setScreenshot] = useState<string>('');
  const [comments, setComments] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const onPlatform = (p: Platform) => {
    setPlatform(p);
    const first = SUB_TASKS[p][0];
    setSubTaskType(first.label);
  };

  const onSubTask = (label: string) => {
    setSubTaskType(label);
    if (!subTaskNeedsComments(label)) {
      setComments('');
    }
  };

  const onFile = (file: File | undefined, setter: (s: string) => void) => {
    if (!file) return setter('');
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };

  const baseRate = SUB_TASKS[platform].find((s) => s.label === subTaskType)?.rate ?? 0;
  const r = rateForLevel(baseRate, level);
  const tw = parseInt(totalWorkers, 10) || 0;
  const subtotal = r * tw;
  const serviceCharge = subtotal * (settings.serviceChargePercent / 100);
  const totalCost = subtotal + serviceCharge;
  const myBalance = profile?.balance ?? 0;

  const showComments = subTaskNeedsComments(subTaskType);
  const nameLabel = PLATFORM_NAME_LABEL[platform];

  const submit = async () => {
    if (!pageName.trim()) {
      setToast({ msg: t(`অনুগ্রহ করে ${nameLabel.bn} লিখুন।`, `Please enter the ${nameLabel.en.toLowerCase()}.`), ok: false });
      return;
    }
    if (tw < settings.minWorkers) {
      setToast({ msg: t(`সর্বনিম্ন ${settings.minWorkers} জন কর্মী প্রয়োজন।`, `At least ${settings.minWorkers} workers required.`), ok: false });
      return;
    }
    if (!screenshot) {
      setToast({ msg: t('অনুগ্রহ করে একটি নমুনা স্ক্রিনশট আপলোড করুন।', 'Please upload a sample screenshot.'), ok: false });
      return;
    }
    const commentLines = comments
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    setSubmitting(true);
    const res = await createJob({
      work_id: `WRK${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      platform,
      sub_task_type: subTaskType,
      job_title: subTaskType,
      rate: r,
      total_workers: tw,
      level,
      employer_name: profile?.full_name || profile?.email || '',
      page_name: pageName.trim(),
      reference_screenshot: screenshot,
      page_link: pageLink.trim() || undefined,
      comment_lines: commentLines,
      instructions: [
        t(`সার্চ বক্সে নাম লিখে নির্দিষ্ট পেজ বা প্রোফাইলটি খুঁজুন: ${pageName.trim()}`, `Search for this specific page or profile: ${pageName.trim()}`),
        t(`বলা অনুযায়ী কাজটি সঠিক নিয়ম মেনে সম্পূর্ণ করুন: ${subTaskType}`, `Complete the task correctly as instructed: ${subTaskType}`),
        t('কাজ শেষ করে একটি পরিষ্কার স্ক্রিনশট নিন', 'Take a clear screenshot after completing the task'),
      ],
      subtotal,
      service_charge: serviceCharge,
      total_cost: totalCost,
    });
    setSubmitting(false);
    setToast({ msg: res.message, ok: res.success });
    if (res.success) {
      setTotalWorkers(''); setPageName(''); setPageLink(''); setScreenshot(''); setComments('');
      await onChanged();
      loadJobs();
    }
  };

  return (
    <div className="space-y-5 px-4 py-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{t('কাজ তৈরি করুন', 'Create Task')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('কর্মীদের জন্য কাজ পোস্ট করুন। খরচ আপনার ব্যালেন্স থেকে কেটে নেওয়া হবে।', 'Post tasks for workers. The cost will be deducted from your balance.')}</p>
      </div>

      {/* Balance hint */}
      <div className="flex items-center justify-between rounded-2xl bg-violet-50 p-3.5 ring-1 ring-violet-200">
        <span className="text-sm font-medium text-violet-700">{t('আপনার ব্যালেন্স', 'Your Balance')}</span>
        <span className="text-sm font-bold text-violet-800">৳ {bdtPlain(myBalance)}</span>
      </div>

      {/* Platform */}
      <div className="card">
        <label className="label">{t('প্ল্যাটফর্ম ক্যাটাগরি', 'Platform Category')}</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.platform}
              onClick={() => onPlatform(c.platform)}
              className={`pill ${platform === c.platform ? 'bg-violet-600 text-white ring-violet-600' : 'bg-white text-slate-600 ring-slate-200'}`}
            >
              <CategoryIcon name={c.icon} className="h-4 w-4" />
              {c.platform}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {t(`${jobCountByPlatform(platform)} টি কাজ বর্তমানে ${platform}-এ চলমান`, `${jobCountByPlatform(platform)} tasks currently active on ${platform}`)}
        </p>
      </div>

      {/* Sub-task type */}
      <div className="card">
        <label className="label">{t('সাব-টাস্ক টাইপ', 'Sub-Task Type')}</label>
        <select value={subTaskType} onChange={(e) => onSubTask(e.target.value)} className="input">
          {SUB_TASKS[platform].map((s) => (
            <option key={s.label} value={s.label}>{s.label} ({t(`৳${s.rate.toFixed(2)} বেইস রেট`, `৳${s.rate.toFixed(2)} base rate`)})</option>
          ))}
        </select>
        <p className="mt-2 text-xs text-slate-500">{t(`রেট স্বয়ংক্রিয়ভাবে নির্ধারিত হয় — লেভেল ${level === 'Level 1' ? '১' : level === 'Level 2' ? '২' : '৩'} অনুযায়ী প্রতি কর্মীর পেমেন্ট ৳${r.toFixed(2)}।`, `Rate is calculated automatically — at ${level} the per-worker payment is ৳${r.toFixed(2)}.`)}</p>
      </div>

      {/* Job details */}
      <div className="card space-y-4">
        <div>
          <label className="label">{t(`মোট কতজন কর্মী প্রয়োজন (সর্বনিম্ন ${settings.minWorkers} জন)`, `Total workers needed (minimum ${settings.minWorkers})`)}</label>
          <input className="input" type="number" min={settings.minWorkers} value={totalWorkers} onChange={(e) => setTotalWorkers(e.target.value)} placeholder="100" />
        </div>
        <div>
          <label className="label">{t('যে লেভেলের কর্মী প্রয়োজন', 'Worker Level Required')}</label>
          <div className="flex gap-2">
            {(['Level 1', 'Level 2', 'Level 3'] as JobLevel[]).map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`pill flex-1 ${level === l ? 'bg-violet-600 text-white ring-violet-600' : 'bg-white text-slate-600 ring-slate-200'}`}
              >
                {t(l === 'Level 1' ? 'লেভেল ১' : l === 'Level 2' ? 'লেভেল ২' : 'লেভেল ৩', l)}
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-violet-50 px-3.5 py-3 ring-1 ring-violet-200">
            <p className="text-xs font-medium text-violet-600">{t(`প্রতি কর্মীর পেমেন্ট (${level === 'Level 1' ? 'লেভেল ১' : level === 'Level 2' ? 'লেভেল ২' : 'লেভেল ৩'})`, `Per-worker payment (${level})`)}</p>
            <p className="text-lg font-bold text-violet-800">৳ {r.toFixed(2)}</p>
          </div>
        </div>
        <div>
          <label className="label">{t(nameLabel.bn, nameLabel.en)}</label>
          <input className="input" value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder={t(nameLabel.placeholderBn, nameLabel.placeholderEn)} />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Link2 size={14} /> {t('পেজ / ভিডিও লিংক (ঐচ্ছিক)', 'Page / Video Link (optional)')}</label>
          <input className="input" value={pageLink} onChange={(e) => setPageLink(e.target.value)} placeholder="https://facebook.com/..." />
        </div>
      </div>

      {/* Screenshot */}
      <div className="card">
        <label className="label">{t('পোস্ট বা প্রোফাইলের নমুনা স্ক্রিনশট', 'Sample Screenshot of Post or Profile')}</label>
        <UploadBox value={screenshot} onChange={(f) => onFile(f, setScreenshot)} onClear={() => setScreenshot('')} label={t('স্ক্রিনশট আপলোড করতে এখানে ট্যাপ করুন', 'Tap here to upload a screenshot')} />
      </div>

      {/* Selective comment lines — only for tasks involving comments/likes/shares/reacts */}
      {showComments && (
        <div className="card">
          <label className="label flex items-center gap-1.5"><MessageSquare size={14} /> {t('নির্দিষ্ট কমেন্টের লাইনসমূহ', 'Specific Comment Lines')}</label>
          <p className="mb-2 text-xs text-slate-500">{t('প্রতি লাইনে একটি কমেন্ট লিখুন। কর্মীরা এখান থেকে একটি কমেন্ট ব্যবহার করবে।', 'Write one comment per line. Workers will pick one from these.')}</p>
          <textarea
            className="input min-h-[100px] resize-y"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={t('দারুণ পেজ!\nখুব তথ্যবহুল\nফলো করছি', 'Great page!\nVery informative\nFollowing now')}
          />
          {comments.trim() && (
            <p className="mt-2 text-xs text-slate-500">
              {t(`${comments.split('\n').filter((l) => l.trim()).length} টি কমেন্ট যোগ হয়েছে`, `${comments.split('\n').filter((l) => l.trim()).length} comments added`)}
            </p>
          )}
        </div>
      )}

      {/* Cost breakdown */}
      {r > 0 && tw > 0 && (
        <div className="card space-y-2.5 bg-violet-50/60 ring-violet-200">
          <p className="flex items-center gap-1.5 text-sm font-bold text-violet-800">
            <Calculator size={16} /> {t('খরচের হিসাব', 'Cost Breakdown')}
          </p>
          <Line label={t(`সাবটোটাল (${tw} × ৳${bdtPlain(r)})`, `Subtotal (${tw} × ৳${bdtPlain(r)})`)} value={`৳ ${bdtPlain(subtotal)}`} />
          <Line label={t(`সার্ভিস চার্জ (${settings.serviceChargePercent}%)`, `Service Charge (${settings.serviceChargePercent}%)`)} value={`৳ ${bdtPlain(serviceCharge)}`} />
          <div className="border-t border-violet-200 pt-2.5">
            <Line label={t('মোট খরচ', 'Total Cost')} value={`৳ ${bdtPlain(totalCost)}`} bold />
          </div>
          <p className={`text-xs font-medium ${myBalance >= totalCost ? 'text-emerald-600' : 'text-rose-600'}`}>
            {myBalance >= totalCost
              ? t(`কেটে নেওয়ার পর ৳ ${bdtPlain(myBalance - totalCost)} অবশিষ্ট থাকবে`, `৳ ${bdtPlain(myBalance - totalCost)} will remain after deduction`)
              : t(`৳ ${bdtPlain(totalCost - myBalance)} ব্যালেন্স কম`, `৳ ${bdtPlain(totalCost - myBalance)} balance short`)}
          </p>
        </div>
      )}

      <button
        onClick={submit}
        disabled={tw < settings.minWorkers || myBalance < totalCost || submitting}
        className="brand-btn w-full py-3 text-base"
      >
        <Check size={18} /> {t('কাজটি পোস্ট করুন', 'Post Task')} · ৳ {bdtPlain(totalCost)}
      </button>

      {toast && <Toast message={toast.msg} onClose={() => setToast(null)} tone={toast.ok ? 'success' : 'error'} />}
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={bold ? 'font-extrabold text-violet-800' : 'font-semibold text-slate-800'}>{value}</span>
    </div>
  );
}

export function UploadBox({
  value, onChange, onClear, label,
}: {
  value: string;
  onChange: (file: File | undefined) => void;
  onClear: () => void;
  label?: string;
}) {
  const { t } = useLanguage();
  return (
    <label className="relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-violet-400 hover:bg-violet-50/50">
      {value ? (
        <>
          <img src={value} alt="preview" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onClear(); }}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <X size={15} />
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1.5 text-slate-400">
          {label ? <Upload size={22} /> : <ImageIcon size={26} />}
          <span className="text-xs font-medium">{label ?? t('স্ক্রিনশট আপলোড করতে এখানে ট্যাপ করুন', 'Tap here to upload a screenshot')}</span>
        </div>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0])} />
    </label>
  );
}
