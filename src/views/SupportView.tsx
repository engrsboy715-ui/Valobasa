import { useEffect, useRef, useState, useCallback } from 'react';
import {
  supabase,
  createTicket,
  fetchMyTickets,
  fetchMessages,
  sendMessage,
  type Profile,
  type SupportTicket,
  type SupportMessage,
} from '@/lib/supabase';
import { timeAgo } from '@/lib/format';
import { Toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  ChevronLeft,
  MessageCircle,
  Send,
  Plus,
  Headphones,
  Loader2,
} from 'lucide-react';

export function SupportView({ onBack, profile }: { onBack: () => void; profile: Profile | null }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const userName = profile?.full_name ?? 'User';
  const userId = profile?.id ?? '';

  const loadTickets = useCallback(async () => {
    const rows = await fetchMyTickets();
    setTickets(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTickets();

    const channel = supabase
      .channel('support_tickets_user')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets', filter: `user_id=eq.${userId}` },
        () => loadTickets(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_messages' },
        () => loadTickets(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadTickets]);

  const startNewChat = async (subject: string, firstMsg: string) => {
    const ticket = await createTicket(subject, firstMsg, userName);
    if (ticket) {
      // Optimistically add to the list immediately so the user sees it without waiting
      setTickets((prev) => {
        if (prev.some((t) => t.id === ticket.id)) return prev;
        return [ticket, ...prev];
      });
      setToast('Support chat started! We will reply soon.');
      setActiveTicket(ticket);
      // Also refresh from DB to get the canonical list
      loadTickets();
    } else {
      // This should never happen now, but just in case:
      setToast('Could not start chat. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-3">
        <button
          onClick={() => (activeTicket ? setActiveTicket(null) : onBack())}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-95"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-base font-bold text-slate-800">
          {activeTicket ? activeTicket.subject : 'Contact & Support'}
        </h1>
        <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      {activeTicket ? (
        <ChatThread ticket={activeTicket} userId={userId} userName={userName} />
      ) : (
        <div className="space-y-5 px-4 py-5 pb-24">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 to-violet-900 p-5 text-white shadow-lg">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <Headphones size={24} />
              </div>
              <div>
                <p className="text-base font-bold">We're here to help</p>
                <p className="text-xs text-violet-200">Start a live chat or browse your tickets below.</p>
              </div>
            </div>
          </div>

          {/* New ticket */}
          <NewTicketForm onStart={startNewChat} />

          {/* Ticket list */}
          <div>
            <h2 className="mb-3 text-sm font-bold text-slate-700">Your Support Chats ({tickets.length})</h2>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 ring-1 ring-slate-200">
                No support chats yet. Start one above.
              </div>
            ) : (
              <div className="space-y-2.5">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTicket(t)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-white p-3.5 text-left ring-1 ring-slate-200/70 transition active:scale-[0.99] hover:ring-violet-200"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                      <MessageCircle size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{t.subject}</p>
                      <p className="text-xs text-slate-400">{timeAgo(new Date(t.updated_at).getTime())}</p>
                    </div>
                    <span className={cn('badge', t.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                      {t.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} tone="success" />}
    </div>
  );
}

function NewTicketForm({ onStart }: { onStart: (subject: string, firstMsg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (subject.trim().length < 3 || message.trim().length < 3) return;
    setBusy(true);
    onStart(subject.trim(), message.trim());
    setBusy(false);
    setOpen(false);
    setSubject('');
    setMessage('');
  };

  return (
    <div className="card space-y-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-sm font-bold text-slate-800"
      >
        <Plus size={18} className="text-violet-600" /> Start a New Support Chat
      </button>
      {open && (
        <div className="space-y-3">
          <div>
            <label className="label">Subject</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Withdrawal issue" />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea className="input min-h-[90px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue…" />
          </div>
          <button
            onClick={start}
            disabled={busy || subject.trim().length < 3 || message.trim().length < 3}
            className="brand-btn w-full py-2.5 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send & Start Chat
          </button>
        </div>
      )}
    </div>
  );
}

function ChatThread({ ticket, userId, userName }: { ticket: SupportTicket; userId: string; userName: string }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const m = await fetchMessages(ticket.id);
    setMessages(m);
    setLoading(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }, [ticket.id]);

  useEffect(() => {
    loadMessages();

    // Skip realtime subscription for local fallback tickets (no DB rows to listen to)
    if (ticket.id.startsWith('local-')) return;

    const channel = supabase
      .channel(`ticket_${ticket.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticket.id}` },
        (payload) => {
          setMessages((prev) => {
            const newMsg = payload.new as SupportMessage;
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticket.id}` },
        () => loadMessages(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticket.id, loadMessages]);

  const send = async () => {
    const body = text.trim();
    if (body.length === 0) return;
    setSending(true);
    setText('');
    const { error } = await sendMessage(ticket.id, body, userName);
    setSending(false);
    if (error) {
      setText(body);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-slate-50">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 ring-1 ring-slate-200">
            No messages yet.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex', m.is_admin ? 'justify-start' : 'justify-end')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                  m.is_admin ? 'bg-white text-slate-800 ring-1 ring-slate-200' : 'bg-violet-600 text-white'
                )}
              >
                {m.is_admin && (
                  <p className="mb-0.5 text-[10px] font-bold text-violet-600">Support Team</p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn('mt-1 text-[10px]', m.is_admin ? 'text-slate-400' : 'text-violet-200')}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 border-t border-slate-200 bg-white px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-violet-400"
          />
          <button
            onClick={send}
            disabled={sending || text.trim().length === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white transition active:scale-90 disabled:opacity-50"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
