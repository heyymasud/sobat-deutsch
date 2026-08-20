-- S6-01 (20260820000005_teacher_workflow.sql) replaced "profiles_select_own" with
-- "profiles_select_public" (`for select using (true)`) to let AdminConsole join
-- display_name for teacher applications/suggestions. This let ANY authenticated
-- user read EVERY other user's full profiles row (display_name, daily limits,
-- theme, ui_language, role) via `select * from profiles` -- a direct violation of
-- BR-AUTH-11/12 (user A must not access user B's data) and a regression from the
-- original design in docs/ARCHITECTURE.md (`profiles_select_own`).
-- Discovered live: user A could fetch user B's full profile row via PostgREST
-- against a local Supabase instance.
--
-- No app code ever queries another user's profile directly (App.tsx, WordDetail.tsx,
-- UserProfile.tsx all filter `.eq('id', <own session id>)`); only AdminConsole.tsx
-- joins profiles(display_name) for teacher_applications/dictionary_suggestions,
-- and only for admins. Fix: restore own-row-only for everyone, add an explicit
-- admin-only broad read for the console's join to keep working.
--
-- A policy that queries `profiles` from within a policy ON `profiles` recurses
-- (42P17) because RLS re-applies itself to the subquery. Route the role check
-- through a SECURITY DEFINER function instead, which runs as its owner and
-- bypasses RLS for that one lookup.

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

drop policy if exists "profiles_select_public" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_select_admin" on public.profiles
  for select using (public.current_user_role() = 'admin');

-- word_reports/dictionary admin policies subquery `profiles` even to evaluate an
-- unauthenticated INSERT ... RETURNING (guest word_reports submissions) -- Postgres
-- needs base SELECT privilege on profiles to plan that subquery at all, regardless
-- of whether any row is actually visible. RLS still returns zero rows for anon here
-- since profiles_select_own requires auth.uid() = id and anon has no auth.uid(),
-- so this grant does not expose any profile data to unauthenticated requests.
grant select on public.profiles to anon;

-- Same reasoning for word_reports: guest INSERT ... RETURNING needs base SELECT
-- privilege on word_reports to plan the statement; RLS ("admin_select_word_reports")
-- still returns zero rows to anon since it isn't an admin.
grant select on public.word_reports to anon;
