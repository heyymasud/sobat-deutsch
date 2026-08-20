-- Add role column to profiles table
alter table public.profiles 
  add column if not exists role text not null default 'student' check (role in ('student', 'teacher', 'admin'));

-- Make sure RLS is enabled and update select policy to allow anyone to read profiles (so students can see teacher names, etc.)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select using (true);

-- Create teacher_applications table
create table if not exists public.teacher_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teacher_applications enable row level security;

-- Policies for teacher_applications
-- 1. Anyone logged in can insert their own application
create policy "insert_own_application" on public.teacher_applications
  for insert with check (auth.uid() = user_id);

-- 2. Owner can select their own applications
create policy "select_own_application" on public.teacher_applications
  for select using (auth.uid() = user_id);

-- 3. Admins can see and update all applications
create policy "admin_all_applications" on public.teacher_applications
  for all using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create dictionary_suggestions table
create table if not exists public.dictionary_suggestions (
  id uuid primary key default gen_random_uuid(),
  word_id bigint not null references public.dictionary(id) on delete cascade,
  proposed_by uuid not null references auth.users(id) on delete cascade,
  proposed_data jsonb not null, -- proposed modifications: translations, gender, plural, example
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason_for_change text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (word_id, proposed_by, status) -- BR-DICT-09: unique pending suggestions per teacher per word
);

alter table public.dictionary_suggestions enable row level security;

-- Policies for dictionary_suggestions
-- 1. Teachers can insert suggestions
create policy "teachers_insert_suggestions" on public.dictionary_suggestions
  for insert with check (
    auth.uid() = proposed_by and
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('teacher', 'admin')
    )
  );

-- 2. Teachers can view their own suggestions
create policy "teachers_select_own_suggestions" on public.dictionary_suggestions
  for select using (
    auth.uid() = proposed_by or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- 3. Admins can do anything on suggestions
create policy "admin_all_suggestions" on public.dictionary_suggestions
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create admin_decision_log table
create table if not exists public.admin_decision_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null, -- 'approve_teacher', 'reject_teacher', 'approve_suggestion', 'reject_suggestion'
  target_id uuid not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.admin_decision_log enable row level security;

-- Only Admins can interact with admin_decision_log
create policy "admin_all_decision_logs" on public.admin_decision_log
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
