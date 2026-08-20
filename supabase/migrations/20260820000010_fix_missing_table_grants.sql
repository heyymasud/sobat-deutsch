-- Fix: tables created via migrations (owned by role `postgres`) never received
-- explicit GRANTs to anon/authenticated. Supabase's default ACL for `postgres`-owned
-- future tables only grants TRUNCATE/REFERENCES/TRIGGER/MAINTAIN to those roles, not
-- SELECT/INSERT/UPDATE/DELETE -- so every RLS policy on these tables was completely
-- unreachable (PostgREST returns 42501 permission denied before RLS even evaluates).
-- Discovered live via cross-user RLS test against a local Supabase instance (S4-10).
-- RLS policies still narrow each grant to the correct rows; these GRANTs only restore
-- the base privilege PostgREST requires to even attempt the query.

grant select, insert, update on public.profiles to authenticated;

grant select, insert, update, delete on public.decks to authenticated;
grant select, insert, update, delete on public.srs_cards to authenticated;

grant select, insert on public.review_logs to authenticated;
grant select, insert, update, delete on public.quiz_sessions to authenticated;
grant select, insert, update, delete on public.quiz_answers to authenticated;
grant select, insert, update, delete on public.mistake_tracker to authenticated;

grant select, insert, update on public.teacher_applications to authenticated;
grant select, insert, update on public.dictionary_suggestions to authenticated;
grant select, insert on public.admin_decision_log to authenticated;

grant insert on public.word_reports to anon;
grant select, insert, update on public.word_reports to authenticated;
grant update on public.dictionary to authenticated;
