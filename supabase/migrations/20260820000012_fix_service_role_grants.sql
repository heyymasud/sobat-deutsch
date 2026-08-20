-- CRITICAL: `service_role` had ZERO SELECT/INSERT/UPDATE/DELETE privilege on EVERY
-- application table (only default TRUNCATE/REFERENCES/TRIGGER from postgres-owned
-- future-object defaults). BYPASSRLS only skips row-level policies -- it does NOT
-- grant the base table privilege PostgREST/postgres-js still requires to run any
-- DML at all. This meant every Edge Function using the service-role client
-- (admin-review-application, admin-review-suggestion, migrate-guest-data) has been
-- completely non-functional for any DB read/write since these tables were created --
-- discovered live via a direct Edge Function call against a local Supabase instance
-- (admin-review-application returned "Unauthorized. Admin role required." for an
-- actual admin, because the service-role client couldn't even read `profiles`).
--
-- service_role is meant to fully bypass RLS by design, so a blanket grant here is
-- correct and safe -- it is never exposed to end users directly.

grant select, insert, update, delete on
  public.profiles,
  public.decks,
  public.srs_cards,
  public.review_logs,
  public.quiz_sessions,
  public.quiz_answers,
  public.mistake_tracker,
  public.teacher_applications,
  public.dictionary_suggestions,
  public.admin_decision_log,
  public.word_reports,
  public.dictionary,
  public.dictionary_meta,
  public.login_attempts
to service_role;
