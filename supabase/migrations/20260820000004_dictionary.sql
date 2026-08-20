create table public.dictionary (
  id bigint generated always as identity primary key,
  lemma text not null,
  pos text,
  gender text check (gender in ('m','f','n') or gender is null),
  plural text,
  genitiv_singular text,
  translations text,
  example text,
  separable_prefix text,
  auxiliary text check (auxiliary in ('haben','sein','both') or auxiliary is null),
  verb_class text check (verb_class in ('weak','strong','mixed','irregular') or verb_class is null),
  ablaut_class text,
  case_governance text[],
  conjugation_table jsonb,
  comparative text,
  superlative text,
  level text check (level in ('A1','A2','B1') or level is null),
  theme_tags text[],
  frequency_rank int,
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('german', coalesce(lemma, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(translations, '')), 'B')
  ) stored
);

create index idx_dictionary_lemma on public.dictionary (lower(lemma));
create index idx_dictionary_search on public.dictionary using gin (search_vector);
create index idx_dictionary_freq on public.dictionary (frequency_rank) where frequency_rank is not null;

-- Read-only untuk semua orang (termasuk anon/Guest) -- BR-DICT-01: dictionary read-only bagi user
alter table public.dictionary enable row level security;
create policy "dictionary_public_read" on public.dictionary
  for select using (true);

-- Versi global dataset -- dicek client tanpa perlu unduh seluruh data (§21.3 PRD)
create table public.dictionary_meta (
  version int not null,
  published_at timestamptz not null default now(),
  row_count int not null,
  checksum text not null
);
alter table public.dictionary_meta enable row level security;
create policy "dictionary_meta_public_read" on public.dictionary_meta
  for select using (true);

insert into public.dictionary_meta (version, row_count, checksum)
  values (1, 0, 'pending-first-import');

grant select on table public.dictionary to anon, authenticated;
grant select on table public.dictionary_meta to anon, authenticated;
