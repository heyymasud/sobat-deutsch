-- Enable Realtime (postgres_changes) on the tables syncEngine now subscribes to,
-- so a change from one device is pushed to a user's other open devices instead
-- of only being picked up on their next app reload/login.
alter publication supabase_realtime add table public.decks;
alter publication supabase_realtime add table public.srs_cards;
alter publication supabase_realtime add table public.review_logs;
alter publication supabase_realtime add table public.mistake_tracker;
