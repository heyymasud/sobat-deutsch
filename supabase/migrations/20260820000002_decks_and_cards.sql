create table public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  card_count int not null default 0
);

alter table public.decks enable row level security;
create policy "decks_owner_all" on public.decks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.srs_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  word_ref text not null,
  card_type text not null check (card_type in ('gender','plural','konjugasi','cloze-kasus','arti')),
  interval int not null default 0,
  ease_factor numeric not null default 2.5,
  repetitions int not null default 0,
  due_date date not null default current_date,
  state text not null default 'new' check (state in ('new','learning','review','suspended')),
  lapses int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deck_id, word_ref, card_type)  -- BR-SRS-01: no duplicate card_type per kata per deck
);

create index idx_srs_cards_due on public.srs_cards (user_id, due_date) where state != 'suspended';

alter table public.srs_cards enable row level security;
create policy "srs_cards_owner_all" on public.srs_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Trigger: update card_count di decks
create or replace function public.update_deck_card_count()
returns trigger as $$
begin
  update public.decks set card_count = (
    select count(*) from public.srs_cards where deck_id = coalesce(new.deck_id, old.deck_id)
  ) where id = coalesce(new.deck_id, old.deck_id);
  return null;
end;
$$ language plpgsql security definer;

create or replace trigger on_srs_card_change
  after insert or delete on public.srs_cards
  for each row execute function public.update_deck_card_count();
