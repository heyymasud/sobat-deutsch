-- S9-01 (AC-SYNC-02, BR-SYNC-02): real timestamp-based conflict resolution for srs_cards sync.
--
-- A plain PostgREST upsert (.upsert() with onConflict) always overwrites the
-- conflicting row — whichever push arrives last at the server wins, not
-- whichever edit is actually newer ("arrival-order wins" instead of
-- "last-write-wins"). PostgREST has no way to express a conditional
-- "only overwrite if newer" upsert, so we expose it as an RPC instead: a
-- single INSERT ... ON CONFLICT ... DO UPDATE ... WHERE clause, which only
-- takes effect when the incoming updated_at is strictly newer than the
-- stored one. SECURITY INVOKER (default) so RLS still enforces
-- auth.uid() = user_id on both the insert and the update branch.
create or replace function public.upsert_srs_card_if_newer(
  p_deck_id uuid,
  p_word_ref text,
  p_card_type text,
  p_interval int,
  p_ease_factor numeric,
  p_repetitions int,
  p_due_date date,
  p_state text,
  p_updated_at timestamptz
) returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.srs_cards (
    deck_id, user_id, word_ref, card_type, interval, ease_factor, repetitions, due_date, state, updated_at
  )
  values (
    p_deck_id, auth.uid(), p_word_ref, p_card_type, p_interval, p_ease_factor, p_repetitions, p_due_date,
    coalesce(p_state, 'new'), p_updated_at
  )
  on conflict (deck_id, word_ref, card_type)
  do update set
    interval = excluded.interval,
    ease_factor = excluded.ease_factor,
    repetitions = excluded.repetitions,
    due_date = excluded.due_date,
    state = coalesce(excluded.state, public.srs_cards.state),
    updated_at = excluded.updated_at
  where excluded.updated_at > public.srs_cards.updated_at;
$$;

grant execute on function public.upsert_srs_card_if_newer(uuid, text, text, int, numeric, int, date, text, timestamptz) to authenticated;
