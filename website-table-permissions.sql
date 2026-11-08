-- KST public website tables: contact form + chatbot FAQ.
-- Safe to run more than once. Run in Supabase SQL Editor.
-- Contact messages are INSERT-only for visitors; FAQ SELECT returns published rows only.

create extension if not exists pgcrypto;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
alter table public.faq_entries enable row level security;

grant usage on schema public to anon, authenticated;

-- Visitors can submit contact messages but cannot list, read, edit or delete them.
revoke all on table public.contact_messages from public, anon, authenticated;
grant insert on table public.contact_messages to anon, authenticated;
-- Remove earlier policies on these two tables before installing the exact public rules below.
-- This prevents a leftover broad SELECT policy from exposing messages or draft FAQs.
do $$
declare existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('contact_messages', 'faq_entries')
  loop
    execute format('drop policy %I on %I.%I', existing_policy.policyname, existing_policy.schemaname, existing_policy.tablename);
  end loop;
end $$;

create policy "kst_public_contact_insert"
  on public.contact_messages for insert to anon, authenticated
  with check (true);

-- Visitors can read only FAQs that KST has explicitly published.
revoke all on table public.faq_entries from public, anon, authenticated;
grant select on table public.faq_entries to anon, authenticated;
create policy "kst_public_read_published_faqs"
  on public.faq_entries for select to anon, authenticated
  using (is_published = true);

-- Add FAQ rows in Supabase Table Editor. Set is_published=true to show them to the chatbot.
