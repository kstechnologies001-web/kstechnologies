-- KST administrator access for the public contact inbox and chatbot FAQ manager.
-- Run this once in Supabase Dashboard > SQL Editor > New query.
-- Safe to re-run. This does NOT promote an account to admin; see the note below.

begin;

-- Ensure row-level security remains enabled on both public website tables.
alter table public.contact_messages enable row level security;
alter table public.faq_entries enable row level security;

-- Admins need SELECT permission to read the contact inbox.
-- The existing visitor INSERT permission is left unchanged.
grant select on table public.contact_messages to authenticated;

drop policy if exists "kst_admin_read_contact_messages" on public.contact_messages;
create policy "kst_admin_read_contact_messages"
  on public.contact_messages
  for select
  to authenticated
  using (public.is_admin());

-- Authenticated users receive table privileges, but RLS below limits all
-- FAQ insert/update/delete and unpublished-row access to administrators only.
grant select, insert, update, delete on table public.faq_entries to authenticated;

drop policy if exists "kst_admin_manage_faqs" on public.faq_entries;
create policy "kst_admin_manage_faqs"
  on public.faq_entries
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;

-- IMPORTANT: After registering and signing in to your administrator account,
-- promote ONLY that account by replacing the email below and running this
-- separate statement in SQL Editor:
--
-- update public.profiles
-- set role = 'admin'
-- where id = (
--   select id from auth.users
--   where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
-- );
--
-- Then sign out and sign back in to refresh the account session.
