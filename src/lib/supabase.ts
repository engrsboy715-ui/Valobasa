import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  balance: number;
  coins: number;
  rank: number;
  referral_code: string | null;
  referred_by: string | null;
  kyc_status: 'none' | 'pending' | 'verified' | 'rejected';
  is_admin: boolean;
  created_at: string;
  lifetime_earnings: number;
  total_deposit: number;
  total_withdraw: number;
  total_spend: number;
  total_penalty: number;
}

export async function fetchProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, balance, coins, rank, referral_code, referred_by, kyc_status, is_admin, created_at, lifetime_earnings, total_deposit, total_withdraw, total_spend, total_penalty')
    .maybeSingle();
  if (error) return null;
  return data as Profile | null;
}

// ---------- Referral ----------
export interface ReferralRow {
  id: string;
  referrer_id: string;
  referee_id: string;
  referrer_coins: number;
  referee_coins: number;
  status: string;
  created_at: string;
  referee_name?: string;
}

export async function applyReferralCode(code: string, refereeId: string) {
  const { data, error } = await supabase.rpc('apply_referral', {
    p_code: code.trim(),
    p_referee: refereeId,
  });
  if (error) return { success: false as const, message: error.message };
  return data as { success: boolean; message: string };
}

export async function fetchMyReferrals(): Promise<ReferralRow[]> {
  const { data, error } = await supabase
    .from('referrals')
    .select('id, referrer_id, referee_id, referrer_coins, referee_coins, status, created_at')
    .or(`referrer_id.eq.${(await supabase.auth.getUser()).data.user?.id}`)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const enriched = await Promise.all(
    data.map(async (r) => {
      const { data: referee } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', r.referee_id)
        .maybeSingle();
      return { ...r, referee_name: referee?.full_name ?? 'New User' };
    })
  );
  return enriched as ReferralRow[];
}

export async function fetchReferralsAsReferrer(): Promise<ReferralRow[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from('referrals')
    .select('id, referrer_id, referee_id, referrer_coins, referee_coins, status, created_at')
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const enriched = await Promise.all(
    data.map(async (r) => {
      const { data: referee } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', r.referee_id)
        .maybeSingle();
      return { ...r, referee_name: referee?.full_name ?? 'New User' };
    })
  );
  return enriched as ReferralRow[];
}

// ---------- Referral reward on first deposit ----------
export async function awardReferralOnFirstDeposit(refereeId: string) {
  const { data, error } = await supabase.rpc('award_referral_on_first_deposit', {
    p_referee: refereeId,
  });
  if (error) return { success: false as const, message: error.message };
  return data as { success: boolean; message: string };
}

// ---------- KYC ----------
export interface KycSubmission {
  id: string;
  user_id: string;
  full_name: string;
  id_type: string;
  id_number: string;
  country: string;
  address: string;
  date_of_birth: string;
  gender: string;
  id_front_img: string;
  id_back_img: string;
  selfie_img: string;
  status: 'pending' | 'verified' | 'rejected';
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export async function submitKyc(input: Omit<KycSubmission, 'id' | 'user_id' | 'status' | 'admin_note' | 'reviewed_at' | 'created_at'>) {
  return supabase.from('kyc_submissions').insert(input).select().maybeSingle();
}

export async function fetchMyKyc(): Promise<KycSubmission | null> {
  const { data, error } = await supabase
    .from('kyc_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as KycSubmission | null;
}

// ---------- Support ----------
export interface SupportTicket {
  id: string;
  user_id: string;
  user_name: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender: string;
  body: string;
  is_admin: boolean;
  created_at: string;
}

export async function createTicket(subject: string, firstMessage: string, userName: string): Promise<SupportTicket | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    console.error('[createTicket] No authenticated user found');
    return localCreateTicket('', userName, subject, firstMessage);
  }

  // Use the atomic SECURITY DEFINER RPC so ticket + first message are created
  // in a single server-side transaction, bypassing any RLS race conditions.
  const { data, error } = await supabase.rpc('create_support_ticket', {
    p_subject: subject,
    p_first_message: firstMessage,
    p_user_name: userName,
  });

  if (error) {
    console.error('[createTicket] RPC failed:', error.message, error.code, error.details);
    // Fallback: try direct insert (works if RLS policies are permissive enough)
    const direct = await directCreateTicket(userId, userName, subject, firstMessage);
    if (direct) return direct;
    // Last resort: local storage so the user's chat is never lost
    return localCreateTicket(userId, userName, subject, firstMessage);
  }

  return data as SupportTicket;
}

async function directCreateTicket(
  userId: string,
  userName: string,
  subject: string,
  firstMessage: string,
): Promise<SupportTicket | null> {
  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .insert({ user_id: userId, user_name: userName, subject })
    .select()
    .maybeSingle();
  if (ticketError || !ticket) {
    console.error('[createTicket] direct ticket insert failed:', ticketError?.message);
    return null;
  }

  const { error: messageError } = await supabase.from('support_messages').insert({
    ticket_id: ticket.id,
    sender_id: userId,
    sender: userName,
    body: firstMessage,
    is_admin: false,
  });
  if (messageError) {
    console.error('[createTicket] direct message insert failed:', messageError.message);
    // Ticket was created but message failed — still return the ticket
  }
  return ticket as SupportTicket;
}

function localCreateTicket(
  userId: string,
  userName: string,
  subject: string,
  firstMessage: string,
): SupportTicket {
  const now = new Date().toISOString();
  const ticket: SupportTicket = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    user_name: userName,
    subject,
    status: 'open',
    created_at: now,
    updated_at: now,
  };
  const message: SupportMessage = {
    id: `local-msg-${Date.now()}`,
    ticket_id: ticket.id,
    sender_id: userId,
    sender: userName,
    body: firstMessage,
    is_admin: false,
    created_at: now,
  };
  try {
    const key = `et_support_fallback_${userId}`;
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : { tickets: [], messages: {} };
    data.tickets = [ticket, ...(data.tickets || [])];
    data.messages = { ...data.messages, [ticket.id]: [message] };
    localStorage.setItem(key, JSON.stringify(data));
    console.warn('[createTicket] Saved ticket to localStorage as fallback');
  } catch {
    /* localStorage may be unavailable */
  }
  return ticket;
}

function localFetchTickets(userId: string): { tickets: SupportTicket[]; messages: Record<string, SupportMessage[]> } {
  try {
    const key = `et_support_fallback_${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return { tickets: [], messages: {} };
    const parsed = JSON.parse(raw);
    return {
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
      messages: parsed.messages && typeof parsed.messages === 'object' ? parsed.messages : {},
    };
  } catch {
    return { tickets: [], messages: {} };
  }
}

export async function fetchMyTickets(): Promise<SupportTicket[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) console.error('[fetchMyTickets] query error:', error.message);

  const remote = (data as SupportTicket[]) ?? [];
  const local = localFetchTickets(userId);
  // Merge local fallback tickets that don't exist in remote
  const remoteIds = new Set(remote.map((t) => t.id));
  const merged = [...remote, ...local.tickets.filter((t) => !remoteIds.has(t.id))];
  merged.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return merged;
}

export async function fetchMessages(ticketId: string): Promise<SupportMessage[]> {
  // Local fallback tickets start with "local-"
  if (ticketId.startsWith('local-')) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? '';
    const local = localFetchTickets(userId);
    return local.messages[ticketId] ?? [];
  }

  const { data, error } = await supabase
    .from('support_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[fetchMessages] query error:', error.message);
    return [];
  }
  return (data as SupportMessage[]) ?? [];
}

export async function sendMessage(ticketId: string, body: string, userName: string) {
  // Local fallback tickets
  if (ticketId.startsWith('local-')) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? '';
    try {
      const key = `et_support_fallback_${userId}`;
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : { tickets: [], messages: {} };
      const now = new Date().toISOString();
      const msg: SupportMessage = {
        id: `local-msg-${Date.now()}`,
        ticket_id: ticketId,
        sender_id: userId,
        sender: userName,
        body,
        is_admin: false,
        created_at: now,
      };
      data.messages = { ...data.messages, [ticketId]: [...(data.messages[ticketId] ?? []), msg] };
      data.tickets = (data.tickets || []).map((t: SupportTicket) =>
        t.id === ticketId ? { ...t, updated_at: now } : t,
      );
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      /* localStorage may be unavailable */
    }
    return { error: null as unknown as Error };
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { error: new Error('Not signed in') };
  const result = await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: userId,
    sender: userName,
    body,
    is_admin: false,
  });
  if (result.error) console.error('[sendMessage] insert failed:', result.error.message);
  return result;
}

// ---------- Ratings ----------
export async function submitRating(stars: number, comment: string, userName: string) {
  return supabase.from('app_ratings').insert({ stars, comment, user_name: userName });
}

// ---------- Notices ----------
export interface Notice {
  id: string;
  title: string;
  body: string;
  active: boolean;
  created_at: string;
}

export async function fetchActiveNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('id, title, body, active, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Notice[];
}

export async function fetchAllNotices(): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('id, title, body, active, created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Notice[];
}

export async function createNotice(title: string, body: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('notices').insert({ title: title.trim(), body: body.trim() });
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'নোটিশ প্রকাশিত হয়েছে।' };
}

export async function toggleNoticeActive(id: string, active: boolean): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('notices').update({ active }).eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: active ? 'নোটিশ সক্রিয় করা হয়েছে।' : 'নোটিশ লুকানো হয়েছে।' };
}

export async function deleteNotice(id: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('notices').delete().eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'নোটিশ মুছে ফেলা হয়েছে।' };
}

// ---------- Admin helpers ----------
export interface AdminKycRow extends KycSubmission {}

export async function adminFetchAllKyc(): Promise<AdminKycRow[]> {
  const { data, error } = await supabase.rpc('admin_list_kyc');
  if (error || !data) return [];
  return data as AdminKycRow[];
}

export async function adminReviewKyc(id: string, status: 'verified' | 'rejected', note: string) {
  const { data, error } = await supabase.rpc('admin_review_kyc', {
    p_id: id,
    p_status: status,
    p_note: note,
  });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export interface AdminTicketRow {
  id: string;
  user_id: string;
  user_name: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_at: string | null;
}

export async function adminFetchTickets(): Promise<AdminTicketRow[]> {
  const { data, error } = await supabase.rpc('admin_list_tickets');
  if (error || !data) return [];
  return data as AdminTicketRow[];
}

export async function adminReply(ticketId: string, body: string) {
  const { data, error } = await supabase.rpc('admin_reply', {
    p_ticket: ticketId,
    p_body: body,
  });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export async function adminFetchTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .rpc('admin_fetch_ticket_messages', { p_ticket: ticketId });
  if (error || !data) return [];
  return data as SupportMessage[];
}

// ---------- Tutorials ----------
export interface Tutorial {
  id: string;
  title: string;
  video_url: string;
  created_at: string;
  updated_at: string;
}

export async function fetchTutorials(): Promise<Tutorial[]> {
  const { data, error } = await supabase
    .from('tutorials')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Tutorial[];
}

export async function createTutorial(title: string, videoUrl: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('tutorials').insert({ title: title.trim(), video_url: videoUrl });
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Tutorial uploaded successfully.' };
}

export async function deleteTutorial(id: string): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('tutorials').delete().eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Tutorial deleted.' };
}

// ---------- Jobs ----------
export interface JobRow {
  id: string;
  user_id: string;
  work_id: string;
  platform: string;
  sub_task_type: string;
  job_title: string;
  rate: number;
  total_workers: number;
  available_slots: number;
  level: string;
  locked: boolean;
  employer_name: string;
  page_name: string;
  reference_screenshot: string;
  page_link: string | null;
  comment_lines: string[];
  instructions: string[];
  status: string;
  subtotal: number;
  service_charge: number;
  total_cost: number;
  created_at: string;
}

export async function fetchAllJobs(): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as JobRow[];
}

export async function fetchMyJobs(): Promise<JobRow[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as JobRow[];
}

export interface AdminDepositRow {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
  method: string;
  sender_number: string;
  trx_id: string;
  screenshot: string;
  status: string;
  created_at: string;
}

export interface AdminWithdrawalRow {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
  service_charge: number;
  total_deducted: number;
  method: string;
  receiver_number: string;
  status: string;
  created_at: string;
}

export async function adminFetchDeposits(): Promise<AdminDepositRow[]> {
  const { data, error } = await supabase.rpc('admin_list_deposits');
  if (error || !data) return [];
  return data as AdminDepositRow[];
}

export async function adminFetchWithdrawals(): Promise<AdminWithdrawalRow[]> {
  const { data, error } = await supabase.rpc('admin_list_withdrawals');
  if (error || !data) return [];
  return data as AdminWithdrawalRow[];
}

export async function adminFetchProofs(): Promise<ProofRow[]> {
  const { data, error } = await supabase.rpc('admin_list_all_proofs');
  if (error || !data) return [];
  return data as ProofRow[];
}

export async function adminFetchUsers(): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('admin_list_users');
  if (error || !data) return [];
  return data as Profile[];
}

export async function createJob(input: {
  work_id: string;
  platform: string;
  sub_task_type: string;
  job_title: string;
  rate: number;
  total_workers: number;
  level: string;
  employer_name: string;
  page_name: string;
  reference_screenshot: string;
  page_link?: string;
  comment_lines: string[];
  instructions: string[];
  subtotal: number;
  service_charge: number;
  total_cost: number;
}): Promise<{ success: boolean; message: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { success: false, message: 'Not authenticated.' };

  const { error } = await supabase.from('jobs').insert({
    user_id: uid,
    work_id: input.work_id,
    platform: input.platform,
    sub_task_type: input.sub_task_type,
    job_title: input.job_title,
    rate: input.rate,
    total_workers: input.total_workers,
    available_slots: input.total_workers,
    level: input.level,
    employer_name: input.employer_name,
    page_name: input.page_name,
    reference_screenshot: input.reference_screenshot,
    page_link: input.page_link ?? null,
    comment_lines: input.comment_lines,
    instructions: input.instructions,
    status: 'Active',
    subtotal: input.subtotal,
    service_charge: input.service_charge,
    total_cost: input.total_cost,
  });
  if (error) return { success: false, message: error.message };

  const { error: txnError } = await supabase.rpc('add_transaction', {
    p_type: 'spend',
    p_amount: input.total_cost,
    p_description: `Created task: ${input.job_title}`,
  });
  if (txnError) return { success: false, message: txnError.message };

  return { success: true, message: `Task created! ৳${input.total_cost.toFixed(2)} deducted. It's now live in Work.` };
}

export async function updateJobStatus(jobId: string, status: string, availableSlots?: number) {
  const update: Record<string, unknown> = { status };
  if (availableSlots !== undefined) update.available_slots = availableSlots;
  return supabase.from('jobs').update(update).eq('id', jobId);
}

// ---------- Deposits ----------
export interface DepositRow {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
  method: string;
  sender_number: string;
  trx_id: string;
  screenshot: string;
  status: string;
  created_at: string;
}

export async function fetchMyDeposits(): Promise<DepositRow[]> {
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as DepositRow[];
}

export async function createDeposit(input: {
  amount: number;
  method: string;
  sender_number: string;
  trx_id: string;
  screenshot: string;
  user_name: string;
}): Promise<{ success: boolean; message: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { success: false, message: 'Please sign in again to submit a deposit.' };

  const profile = await fetchProfile();
  if (!profile || profile.id !== userId) {
    return { success: false, message: 'Your account profile could not be found. Please sign out and sign in again.' };
  }

  const { error } = await supabase.from('deposits').insert({
    user_id: userId,
    amount: input.amount,
    method: input.method,
    sender_number: input.sender_number,
    trx_id: input.trx_id,
    screenshot: input.screenshot,
    user_name: input.user_name,
    status: 'pending',
  });
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Deposit request sent! Awaiting admin approval.' };
}

// ---------- Withdrawals ----------
export interface WithdrawalRow {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
  service_charge: number;
  total_deducted: number;
  method: string;
  receiver_number: string;
  status: string;
  created_at: string;
}

export async function fetchMyWithdrawals(): Promise<WithdrawalRow[]> {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as WithdrawalRow[];
}

export async function createWithdrawal(input: {
  amount: number;
  service_charge: number;
  total_deducted: number;
  method: string;
  receiver_number: string;
  user_name: string;
}): Promise<{ success: boolean; message: string }> {
  const { error: wdError } = await supabase.from('withdrawals').insert({
    amount: input.amount,
    service_charge: input.service_charge,
    total_deducted: input.total_deducted,
    method: input.method,
    receiver_number: input.receiver_number,
    user_name: input.user_name,
    status: 'pending',
  });
  if (wdError) return { success: false, message: wdError.message };

  const { error: txnError } = await supabase.rpc('add_transaction', {
    p_type: 'withdraw',
    p_amount: input.total_deducted,
    p_description: `Withdraw: ${input.method} (Net ৳${input.amount.toFixed(2)} + Charge ৳${input.service_charge.toFixed(2)})`,
  });
  if (txnError) return { success: false, message: txnError.message };

  return { success: true, message: `Withdrawal request sent. ৳${input.total_deducted.toFixed(2)} deducted from balance.` };
}

// ---------- Proofs ----------
export interface ProofRow {
  id: string;
  job_id: string;
  work_id: string;
  worker_id: string;
  worker_name: string;
  screenshot: string;
  screenshots: string[];
  status: string;
  reward: number;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export async function fetchMyProofs(): Promise<ProofRow[]> {
  const { data, error } = await supabase
    .from('proofs')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (error || !data) return [];
  return data as ProofRow[];
}

export async function fetchProofsForJob(jobId: string): Promise<ProofRow[]> {
  const { data, error } = await supabase
    .from('proofs')
    .select('*')
    .eq('job_id', jobId)
    .order('submitted_at', { ascending: false });
  if (error || !data) return [];
  return data as ProofRow[];
}

export async function submitProof(input: {
  job_id: string;
  work_id: string;
  worker_name: string;
  screenshot: string;
  screenshots: string[];
  reward: number;
}): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('proofs').insert({
    job_id: input.job_id,
    work_id: input.work_id,
    worker_name: input.worker_name,
    screenshot: input.screenshot,
    screenshots: input.screenshots,
    status: 'Pending',
    reward: input.reward,
  });
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Proof submitted! Status is now Pending. Admin will review it shortly.' };
}

export async function approveProofRPC(proofId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('approve_proof', { p_proof_id: proofId });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export async function rejectProofRPC(proofId: string, reason: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('reject_proof', { p_proof_id: proofId, p_reason: reason });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

// ---------- Transactions ----------
export interface TransactionRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export async function fetchMyTransactions(): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as TransactionRow[];
}

// ---------- Admin deposit/withdrawal functions ----------
export async function adminApproveDeposit(depositId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('approve_deposit', { p_deposit_id: depositId });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export async function adminRejectDeposit(depositId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('reject_deposit', { p_deposit_id: depositId });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export async function adminApproveWithdrawal(withdrawalId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('approve_withdrawal', { p_withdrawal_id: withdrawalId });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}

export async function adminRejectWithdrawal(withdrawalId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('reject_withdrawal', { p_withdrawal_id: withdrawalId });
  if (error) return { success: false, message: error.message };
  return data as { success: boolean; message: string };
}
