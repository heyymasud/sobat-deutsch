create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  daily_new_limit int not null default 20,
  daily_review_limit int not null default 100,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  ui_language text not null default 'id',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create profile saat user baru terdaftar (FR-AUTH-02)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
