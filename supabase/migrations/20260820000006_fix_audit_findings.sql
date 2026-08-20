-- Drop old decision log policy and set it to select-only for admins
drop policy if exists "admin_all_decision_logs" on public.admin_decision_log;

create policy "admin_select_decision_logs" on public.admin_decision_log
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Refactor dictionary_suggestions for per-field level suggestions
drop table if exists public.dictionary_suggestions cascade;

create table public.dictionary_suggestions (
  id uuid primary key default gen_random_uuid(),
  word_id bigint not null references public.dictionary(id) on delete cascade,
  proposed_by uuid not null references auth.users(id) on delete cascade,
  field_name text not null check (field_name in ('translations', 'gender', 'plural', 'example')),
  suggested_value text, -- can be null/empty
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason_for_change text not null,
  note text, -- admin feedback note
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dictionary_suggestions enable row level security;

-- Policies for dictionary_suggestions
-- 1. Teachers/Admins can insert suggestions
create policy "teachers_insert_suggestions" on public.dictionary_suggestions
  for insert with check (
    auth.uid() = proposed_by and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('teacher', 'admin')
    )
  );

-- 2. Teachers can select their own, Admins all
create policy "teachers_select_own_suggestions" on public.dictionary_suggestions
  for select using (
    auth.uid() = proposed_by or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 3. Admins can update suggestions (to change status/note/suggested_value)
create policy "admin_update_suggestions" on public.dictionary_suggestions
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Enforce BR-DICT-09: No duplicate pending suggestions per field + lemma/word_id per teacher
create unique index dictionary_suggestions_uniq_pending 
  on public.dictionary_suggestions(word_id, proposed_by, field_name) 
  where (status = 'pending');
