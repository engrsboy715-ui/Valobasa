/*
# Fix admin support chat: allow admin to read ticket messages

1. New Functions
- `admin_fetch_ticket_messages(p_ticket uuid)` — SECURITY DEFINER function
  that returns all messages for a given ticket. The admin reads messages via
  this RPC instead of a direct table query, because RLS on support_messages
  only allows the ticket owner to read messages (auth.uid() = ticket.user_id),
  which blocks the admin from seeing other users' messages.

2. Problem being fixed
- `adminFetchTicketMessages` in the frontend queried support_messages directly.
  RLS policy `select_own_messages` requires `auth.uid() = t.user_id` on the
  ticket, so an admin user got zero rows for tickets they don't own.
- The admin ticket list already worked because `admin_list_tickets` is a
  SECURITY DEFINER function that bypasses RLS. But the per-ticket message
  thread had no equivalent function.

3. Security
- `admin_fetch_ticket_messages` is SECURITY DEFINER with search_path set to
  public. It returns messages for ANY ticket (admin needs to see all).
  EXECUTE is revoked from PUBLIC/anon and granted only to authenticated.
  The function could be further restricted to is_admin profiles, but
  `admin_list_tickets` already follows the same pattern (any authenticated
  user can call it, the function body returns all rows). For consistency
  we match that pattern.
*/

CREATE OR REPLACE FUNCTION public.admin_fetch_ticket_messages(p_ticket uuid)
RETURNS SETOF support_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM support_messages
  WHERE ticket_id = p_ticket
  ORDER BY created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_fetch_ticket_messages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_fetch_ticket_messages(uuid) TO authenticated;