/*
# Atomic support ticket creation

## Problem
`createTicket` in the frontend does two separate inserts:
  1. INSERT into support_tickets
  2. INSERT into support_messages (the first message)
Both are subject to RLS. The message insert policy requires
`sender_id = auth.uid()` AND a subquery checking ticket ownership.
If anything is slightly off (timing, session, column defaults), the
second insert fails silently and the user sees "Could not start chat."

## Fix
Create a SECURITY DEFINER function that atomically creates the ticket
and its first message in a single RPC call, bypassing RLS entirely.
This eliminates the two-insert race and the RLS permission issue.
*/

CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_subject text,
  p_first_message text,
  p_user_name text
)
RETURNS support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ticket support_tickets;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_subject IS NULL OR btrim(p_subject) = '' THEN
    RAISE EXCEPTION 'Subject is required';
  END IF;
  IF p_first_message IS NULL OR btrim(p_first_message) = '' THEN
    RAISE EXCEPTION 'Message is required';
  END IF;

  INSERT INTO support_tickets (user_id, user_name, subject)
    VALUES (v_user_id, p_user_name, p_subject)
    RETURNING * INTO v_ticket;

  INSERT INTO support_messages (ticket_id, sender_id, sender, body, is_admin)
    VALUES (v_ticket.id, v_user_id, p_user_name, p_first_message, false);

  RETURN v_ticket;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_support_ticket(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(text, text, text) TO authenticated;