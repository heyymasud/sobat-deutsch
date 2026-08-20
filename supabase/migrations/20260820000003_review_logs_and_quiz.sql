create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.srs_cards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating text not null check (rating in ('lupa','sulit','sedang','mudah')),
  reviewed_at timestamptz not null default now(),
  interval_before int not null,
  interval_after int not null,
  response_time_ms int
);
-- Append-only (BR-SYNC-03): tidak ada UPDATE policy, hanya INSERT+SELECT
alter table public.review_logs enable row level security;
create policy "review_logs_owner_select" on public.review_logs
  for select using (auth.uid() = user_id);
create policy "review_logs_owner_insert" on public.review_logs
  for insert with check (auth.uid() = user_id);

create table public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  duration_s int not null,
  score int not null default 0,
  max_streak int not null default 0,
  scope text not null default 'level',
  created_at timestamptz not null default now()
);
alter table public.quiz_sessions enable row level security;
create policy "quiz_sessions_owner_all" on public.quiz_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  word_ref text not null,
  correct boolean not null,
  response_time_ms int
);
alter table public.quiz_answers enable row level security;
create policy "quiz_answers_via_session" on public.quiz_answers
  for all using (
    exists (select 1 from public.quiz_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create table public.mistake_tracker (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_ref text not null,
  mistake_count int not null default 1,
  last_mistake_at timestamptz not null default now(),
  recommended_to_deck boolean not null default false,
  primary key (user_id, word_ref)
);
alter table public.mistake_tracker enable row level security;
create policy "mistake_tracker_owner_all" on public.mistake_tracker
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
