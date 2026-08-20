-- S6-10: lightweight "report this word is wrong" flow for Student/Guest (FR-DICT-16, FR-ADM-01/02)
-- Distinct from the Teacher structured dictionary_suggestions flow: no field_name/proposed_value,
-- just free-text note. Admin applies corrections directly to `dictionary` (no approval Edge Function).
create table public.word_reports (
  id uuid primary key default gen_random_uuid(),
  word_id bigint not null references public.dictionary(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null, -- null for guest reports
  note text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.word_reports enable row level security;

-- Anyone (including anon/guest) can insert their own report
create policy "anyone_insert_word_report" on public.word_reports
  for insert with check (
    reporter_id is null or reporter_id = auth.uid()
  );

-- Only admins can view/update reports
create policy "admin_select_word_reports" on public.word_reports
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "admin_update_word_reports" on public.word_reports
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admin needs to apply corrections directly to `dictionary` from the client (no Edge Function for this flow)
create policy "admin_update_dictionary" on public.dictionary
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
