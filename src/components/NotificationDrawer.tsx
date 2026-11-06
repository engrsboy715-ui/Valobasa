import { useEffect, useState } from 'react';
import { fetchActiveNotices, type Notice } from '@/lib/supabase';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import { Bell, X, Megaphone, Inbox } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const READ_KEY = 'et_read_notice_ids';

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function NotificationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchActiveNotices().then((data) => {
      setNotices(data);
      setLoading(false);
    });
  }, [open]);

  const markAllRead = () => {
    const next = new Set(readIds);
    notices.forEach((n) => next.add(n.id));
    setReadIds(next);
    saveReadIds(next);
  };

  const markRead = (id: string) => {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadIds(next);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-pop" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 flex h-full w-[88%] max-w-sm flex-col bg-white shadow-2xl animate-pop">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <Bell size={18} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-800">{t('নোটিশ', 'Notices')}</h2>
              <p className="text-[11px] text-slate-500">{t(`${notices.length} টি বিজ্ঞপ্তি`, `${notices.length} notices`)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notices.some((n) => !readIds.has(n.id)) && (
              <button
                onClick={markAllRead}
                className="rounded-lg bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200 active:scale-95"
              >
                {t('সব পঠিত', 'Mark All Read')}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
              <p className="mt-3 text-xs">{t('লোড হচ্ছে...', 'Loading...')}</p>
            </div>
          ) : notices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Inbox size={36} strokeWidth={1.5} />
              <p className="mt-3 text-sm font-medium text-slate-500">{t('কোনো নোটিশ নেই', 'No notices')}</p>
              <p className="mt-1 text-xs text-slate-400">{t('নতুন বিজ্ঞপ্তি এলে এখানে দেখা যাবে', 'New notices will appear here')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => {
                const isUnread = !readIds.has(notice.id);
                return (
                  <button
                    key={notice.id}
                    onClick={() => markRead(notice.id)}
                    className={cn(
                      'block w-full rounded-2xl p-4 text-left ring-1 transition active:scale-[0.99]',
                      isUnread
                        ? 'bg-violet-50/60 ring-violet-200'
                        : 'bg-white ring-slate-200'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        isUnread ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'
                      )}>
                        <Megaphone size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-slate-800">{notice.title}</p>
                          {isUnread && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{notice.body}</p>
                        <p className="mt-2 text-[10px] font-medium text-slate-400">{timeAgo(new Date(notice.created_at).getTime())}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function useUnreadNoticeCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const notices = await fetchActiveNotices();
      if (!active) return;
      const readIds = getReadIds();
      const unread = notices.filter((n) => !readIds.has(n.id)).length;
      setCount(unread);
    };
    load();
    const interval = setInterval(load, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  return count;
}
