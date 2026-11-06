/*
# Secure support chat ownership policies

## Purpose
Restore private, owner-scoped access for support chats while keeping the
support tables available to signed-in users. The previous fallback policy used
`USING (true)` for all authenticated users, which allowed every signed-in user
to read every customer's support conversation.

## Changes
- `support_tickets`: authenticated users can read only their own tickets and
  insert tickets owned by their current session.
- `support_messages`: authenticated users can read and insert messages only
  within tickets they own.
- RLS remains enabled and existing grants remain in place.
- Guest users are intentionally not granted database access because support
  conversations contain private user communications. The frontend provides a
  local fallback for environments where a guest or unavailable backend cannot
  create a remote chat.
*/

DROP POLICY IF EXISTS "select_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_tickets" ON support_tickets;
CREATE POLICY "insert_own_tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_messages" ON support_messages;
CREATE POLICY "select_own_messages"
  ON support_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_messages" ON support_messages;
CREATE POLICY "insert_own_messages"
  ON support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_admin = false
    AND EXISTS (
      SELECT 1
      FROM support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND t.user_id = auth.uid()
    )
  );
