import { useState, useEffect, useMemo } from 'react';
import type { Job, JobStatus, ProofSubmission } from '@/types';
import { bdt, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Toast, CopyButton } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CATEGORIES } from '@/data/categories';
import { useLanguage } from '@/lib/LanguageContext';
import { approveProofRPC, fetchAllJobs, fetchMyJobs, fetchMyProofs, fetchProofsForJob, rejectProofRPC } from '@/lib/supabase';
import { toJob, toProof } from '@/lib/mappers';
import { ChevronLeft, ChevronRight, Check, X, Clock, Eye } from 'lucide-react';
import { useJobsRealtime } from '@/lib/useJobsRealtime';

type StatusTab = 'Active' | 'Pending' | 'Completed' | 'Rejected';
type TimeFilter = 'this_week' | 'last_week' | 'this_month' | 'last_month';

function getTimeRange(filter: TimeFilter): { start: number; end: number } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - dayOfWeek);
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  switch (filter) {
    case 'this_week':
      return { start: startOfThisWeek.getTime(), end: Date.now() };
    case 'last_week':
      return { start: startOfLastWeek.getTime(), end: startOfThisWeek.getTime() - 1 };
    case 'this_month':
      return { start: startOfThisMonth.getTime(), end: Date.now() };
    case 'last_month':
      return { start: startOfLastMonth.getTime(), end: endOfLastMonth.getTime() };
  }
}

export function MyCreatedWork({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [proofs, setProofs] = useState<ProofSubmission[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>('Active');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('this_week');
  const [reviewingJob, setReviewingJob] = useState<Job | null>(null);
  const [rejectProofId, setRejectProofId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const loadData = async () => {
    const rows = await fetchMyJobs();
    const lists = await Promise.all(rows.map((r) => fetchProofsForJob(r.id)));
    setMyJobs(rows.map(toJob));
    setProofs(lists.flat().map(toProof));
  };

  useEffect(() => {
    loadData();
  }, []);

  useJobsRealtime(() => { void loadData(); });

  const { start, end } = getTimeRange(timeFilter);
  const filteredJobs = useMemo(
    () => myJobs.filter((j) => j.createdAt >= start && j.createdAt <= end && j.status === statusTab),
    [myJobs, start, end, statusTab]
  );

  const counts = useMemo(() => ({
    Active: myJobs.filter((j) => j.status === 'Active').length,
    Pending: myJobs.filter((j) => j.status === 'Pending').length,
    Rejected: myJobs.filter((j) => j.status === 'Rejected').length,
    Completed: myJobs.filter((j) => j.status === 'Completed').length,
  }), [myJobs]);

  const jobProofs = (jobId: string) => proofs.filter((p) => p.jobId === jobId);

  const doApprove = async (proofId: string) => {
    const res = await approveProofRPC(proofId);
    if (res.success) await loadData();
    setToast(res.success ? t('প্রমাণ অনুমোদিত হয়েছে। কর্মীকে পেমেন্ট প্রদান করা হয়েছে।', 'Proof approved. Payment sent to worker.') : res.message);
  };

  const doReject = async () => {
    if (!rejectProofId) return;
    if (!rejectReason.trim()) {
      setToast(t('অনুগ্রহ করে বাতিলের কারণ লিখুন।', 'Please enter a rejection reason.'));
      return;
    }
    const res = await rejectProofRPC(rejectProofId, rejectReason.trim());
    setRejectProofId(null);
    setRejectReason('');
    if (res.success) await loadData();
    setToast(res.success ? t('প্রমাণ বাতিল করা হয়েছে।', 'Proof rejected.') : res.message);
  };

  const cat = CATEGORIES.find((c) => c.platform === reviewingJob?.platform);

  const statusTabs: { key: StatusTab; label: string }[] = [
    { key: 'Active', label: t('Publish', 'Publish') },
    { key: 'Pending', label: t('Pending', 'Pending') },
    { key: 'Rejected', label: t('Reject', 'Reject') },
    { key: 'Completed', label: t('Complete', 'Complete') },
  ];

  const timeFilters: { key: TimeFilter; label: string }[] = [
    { key: 'this_week', label: t('এই সপ্তাহ', 'This Week') },
    { key: 'last_week', label: t('গত সপ্তাহ', 'Last Week') },
    { key: 'this_month', label: t('এই মাস', 'This Month') },
    { key: 'last_month', label: t('গত মাস', 'Last Month') },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <Header title={t('আমার দেওয়া কাজ', 'Jobs I Posted')} onBack={onBack} />

      <div className="px-4 py-4">
        {/* Status tabs */}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusTab(tab.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition',
                statusTab === tab.key
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200'
              )}
            >
              {tab.label}
              <span className={cn(
                'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                statusTab === tab.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
              )}>
                {counts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* Time filters */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {timeFilters.map((tf) => (
            <button
              key={tf.key}
              onClick={() => setTimeFilter(tf.key)}
              className={cn(
                'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition',
                timeFilter === tf.key
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-500 ring-1 ring-slate-200'
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Job list */}
        {filteredJobs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-500">{t('এই ফিল্টারে কোনো কাজ নেই।', 'No tasks in this filter.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => {
              const pCount = jobProofs(job.id);
              const pendingCount = pCount.filter((p) => p.status === 'Pending').length;
              const approvedCount = pCount.filter((p) => p.status === 'Approved').length;
              const jobCat = CATEGORIES.find((c) => c.platform === job.platform);
              return (
                <div key={job.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white', jobCat?.color ?? 'from-slate-400 to-slate-600')}>
                      <CategoryIcon name={jobCat?.icon ?? 'Briefcase'} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{job.subTaskType}</p>
                      <p className="text-xs text-slate-500">{job.pageName} · {timeAgo(job.createdAt)}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="badge bg-emerald-100 text-emerald-700">{bdt(job.rate)}/{t('কর্মী', 'worker')}</span>
                        {pendingCount > 0 && (
                          <span className="badge bg-amber-100 text-amber-700 animate-pulse">{pendingCount} {t('পেন্ডিং প্রমাণ', 'pending proofs')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <SlotBreakdown
                    total={job.totalWorkers}
                    pending={pendingCount}
                    approved={approvedCount}
                    remaining={job.availableSlots}
                  />
                  {pendingCount > 0 && (
                    <button
                      onClick={() => setReviewingJob(job)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-50 py-2.5 text-sm font-semibold text-violet-700 ring-1 ring-violet-200 transition active:scale-95"
                    >
                      <Eye size={16} /> {t(`${pendingCount} টি প্রমাণ যাচাই করুন`, `Review ${pendingCount} proof${pendingCount > 1 ? 's' : ''}`)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review modal */}
      {reviewingJob && (
        <ReviewModal
          job={reviewingJob}
          proofs={jobProofs(reviewingJob.id)}
          onApprove={doApprove}
          onRejectStart={(pid) => { setRejectProofId(pid); setRejectReason(''); }}
          onClose={() => setReviewingJob(null)}
          catColor={cat?.color ?? 'from-slate-400 to-slate-600'}
          catIcon={cat?.icon ?? 'Briefcase'}
        />
      )}

      {/* Reject reason modal */}
      {rejectProofId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setRejectProofId(null)}>
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-bold text-slate-800">{t('বাতিলের কারণ', 'Rejection Reason')}</h3>
            <textarea
              className="input min-h-[80px] resize-y"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('যেমন: স্ক্রিনশটে কাজটি স্পষ্ট নয়', 'e.g. The screenshot does not clearly show the task')}
            />
            <div className="mt-4 flex gap-2">
              <button onClick={doReject} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white active:scale-95">
                <X size={16} /> {t('বাতিল করুন', 'Reject')}
              </button>
              <button onClick={() => setRejectProofId(null)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 active:scale-95">
                {t('ফিরে যান', 'Go Back')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} tone="success" />}
    </div>
  );
}

// ---- My Submissions ----
function SlotBreakdown({ total, pending, approved, remaining }: { total: number; pending: number; approved: number; remaining: number }) {
  const { t } = useLanguage();
  const cells = [
    { label: t('মোট স্লট', 'Total'), value: total, tone: 'text-slate-800' },
    { label: t('পেন্ডিং', 'Pending'), value: pending, tone: 'text-amber-600' },
    { label: t('অনুমোদিত', 'Approved'), value: approved, tone: 'text-emerald-600' },
    { label: t('বাকি স্লট', 'Remaining'), value: remaining, tone: 'text-violet-700' },
  ];
  return (
    <div className="mt-3 grid grid-cols-4 divide-x divide-slate-100 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200/70">
      {cells.map((c) => (
        <div key={c.label} className="px-2 py-2 text-center">
          <p className={cn('text-base font-extrabold tabular-nums', c.tone)}>{c.value}</p>
          <p className="text-[10px] font-medium text-slate-500">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

export function MySubmissions({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [myProofs, setMyProofs] = useState<ProofSubmission[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    fetchMyProofs().then((rows) => setMyProofs(rows.map(toProof)));
    fetchAllJobs().then((rows) => setJobs(rows.map(toJob)));
  }, []);

  const counts = {
    Pending: myProofs.filter((p) => p.status === 'Pending').length,
    Approved: myProofs.filter((p) => p.status === 'Approved').length,
    Rejected: myProofs.filter((p) => p.status === 'Rejected').length,
  };

  const filtered = myProofs.filter((p) => p.status === tab);

  return (
    <div className="min-h-full bg-slate-50">
      <Header title={t('আমার করা কাজ', 'My Completed Tasks')} onBack={onBack} />

      <div className="px-4 py-4">
        {/* Tabs */}
        <div className="mb-4 flex gap-2">
          {(['Pending', 'Approved', 'Rejected'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition',
                tab === tabKey
                  ? tabKey === 'Pending' ? 'bg-amber-500 text-white'
                    : tabKey === 'Approved' ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200'
              )}
            >
              {tabKey === 'Pending' ? t('পেন্ডিং', 'Pending') : tabKey === 'Approved' ? t('অনুমোদিত', 'Approved') : t('বাতিলকৃত', 'Rejected')}
              <span className={cn(
                'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                tab === tabKey ? 'bg-white/25' : 'bg-slate-100 text-slate-500'
              )}>
                {counts[tabKey]}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-500">{t('এই বিভাগে কোনো কাজ নেই।', 'No tasks in this section.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <ProofCard key={p.id} proof={p} job={jobs.find((j) => j.id === p.jobId)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProofCard({ proof, job }: { proof: ProofSubmission; job: Job | undefined }) {
  const { t } = useLanguage();
  const cat = CATEGORIES.find((c) => c.platform === job?.platform);

  const autoApproveMs = 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - proof.submittedAt;
  const remaining = Math.max(0, autoApproveMs - elapsed);
  const autoApproveHours = Math.floor(remaining / (60 * 60 * 1000));
  const autoApproveMins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/70 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white', cat?.color ?? 'from-slate-400 to-slate-600')}>
          <CategoryIcon name={cat?.icon ?? 'Briefcase'} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{job?.subTaskType ?? proof.workId}</p>
          <p className="text-xs text-slate-500">{job?.pageName ?? '—'} · {timeAgo(proof.submittedAt)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="badge bg-emerald-100 text-emerald-700">{t('পুরস্কার', 'Reward')} {bdt(proof.reward)}</span>
            <span className={cn(
              'badge',
              proof.status === 'Pending' ? 'bg-amber-100 text-amber-700'
                : proof.status === 'Approved' ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-700'
            )}>
              {proof.status === 'Pending' ? t('পেন্ডিং', 'Pending') : proof.status === 'Approved' ? t('অনুমোদিত', 'Approved') : t('বাতিলকৃত', 'Rejected')}
            </span>
          </div>
        </div>
        <img src={proof.screenshot} alt="proof" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
      </div>

      {/* Auto-approval countdown for pending */}
      {proof.status === 'Pending' && remaining > 0 && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-200">
          <Clock size={13} />
          <span>{t('স্বয়ংক্রিয় অনুমোদনের জন্য অবশিষ্ট:', 'Auto-approval in:')} {autoApproveHours}{t('ঘ', 'h')} {autoApproveMins}{t('মি', 'm')}</span>
        </div>
      )}
      {proof.status === 'Pending' && remaining === 0 && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
          <Clock size={13} />
          <span>{t('শীঘ্রই স্বয়ংক্রিয়ভাবে অনুমোদিত হবে...', 'Will be auto-approved soon...')}</span>
        </div>
      )}

      {/* Rejection reason */}
      {proof.status === 'Rejected' && proof.rejectionReason && (
        <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
          {t('কারণ:', 'Reason:')} {proof.rejectionReason}
        </div>
      )}

      {/* All screenshots */}
      {proof.screenshots.length > 1 && (
        <div className="mt-3 flex gap-2">
          {proof.screenshots.map((s, i) => (
            <img key={i} src={s} alt={`proof ${i + 1}`} className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Review Modal ----
function ReviewModal({
  job, proofs, onApprove, onRejectStart, onClose, catColor, catIcon,
}: {
  job: Job;
  proofs: ProofSubmission[];
  onApprove: (proofId: string) => void;
  onRejectStart: (proofId: string) => void;
  onClose: () => void;
  catColor: string;
  catIcon: string;
}) {
  const { t } = useLanguage();
  const pending = proofs.filter((p) => p.status === 'Pending');
  const reviewed = proofs.filter((p) => p.status !== 'Pending');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white', catColor)}>
            <CategoryIcon name={catIcon} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800">{job.subTaskType}</p>
            <p className="text-xs text-slate-500">{job.pageName} · {job.workId}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {pending.length === 0 && reviewed.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-500">{t('কোনো প্রমাণ জমা দেওয়া হয়নি।', 'No proofs submitted.')}</p>
        )}

        {pending.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-bold text-amber-700">{t('পেন্ডিং প্রমাণ', 'Pending Proofs')} ({pending.length})</p>
            <div className="space-y-3">
              {pending.map((p) => (
                <ProofReviewCard key={p.id} proof={p} onApprove={onApprove} onRejectStart={onRejectStart} />
              ))}
            </div>
          </div>
        )}

        {reviewed.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">{t('যাচাই করা প্রমাণ', 'Reviewed Proofs')} ({reviewed.length})</p>
            <div className="space-y-2">
              {reviewed.slice(0, 10).map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <img src={p.screenshot} alt="proof" className="h-12 w-12 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-700">{p.workerName}</p>
                    <p className="text-[10px] text-slate-500">{timeAgo(p.submittedAt)}</p>
                  </div>
                  <span className={cn(
                    'badge text-[10px]',
                    p.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  )}>
                    {p.status === 'Approved' ? t('অনুমোদিত', 'Approved') : t('বাতিলকৃত', 'Rejected')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProofReviewCard({
  proof, onApprove, onRejectStart,
}: {
  proof: ProofSubmission;
  onApprove: (proofId: string) => void;
  onRejectStart: (proofId: string) => void;
}) {
  const { t } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const shots = proof.screenshots.length > 0 ? proof.screenshots : [proof.screenshot];

  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-700">{proof.workerName}</p>
          <p className="text-[10px] text-slate-500">{timeAgo(proof.submittedAt)} · {t('পুরস্কার', 'Reward')} {bdt(proof.reward)}</p>
        </div>
        <CopyButton text={proof.workId} label={proof.workId} className="text-[10px]" />
      </div>

      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {shots.slice(0, showAll ? shots.length : 3).map((s, i) => (
          <a key={i} href={s} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg ring-1 ring-slate-200">
            <img src={s} alt={`proof ${i + 1}`} className="h-full w-full object-cover" />
          </a>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onApprove(proof.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white active:scale-95"
        >
          <Check size={14} /> {t('অনুমোদন', 'Approve')}
        </button>
        <button
          onClick={() => onRejectStart(proof.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2.5 text-xs font-semibold text-white active:scale-95"
        >
          <X size={14} /> {t('বাতিল', 'Reject')}
        </button>
      </div>
    </div>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur-md">
      <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95">
        <ChevronLeft size={20} />
      </button>
      <h1 className="text-base font-bold text-slate-800">{title}</h1>
    </div>
  );
}

export { ChevronRight };
