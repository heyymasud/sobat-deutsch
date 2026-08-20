-- S4-03: Server-side login rate limiting (BR-AUTH-05, AC-AUTH-07, FR-AUTH-14)
-- Previous implementation tracked failed attempts only in localStorage, which
-- is trivially bypassed (clear storage / incognito). This moves the lock to
-- Postgres and only exposes it through a SECURITY DEFINER RPC.

create table public.login_attempts (
  email text primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;

-- No policies are created: table is only readable/writable via the
-- SECURITY DEFINER function below, never directly by anon/authenticated roles.

create or replace function public.check_and_record_login_attempt(
  p_email text,
  p_success boolean
)
returns table(locked boolean, locked_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_row public.login_attempts%rowtype;
begin
  select * into v_row from public.login_attempts where email = v_email for update;

  -- Already locked and lock hasn't expired: report locked, don't touch counter.
  if v_row.locked_until is not null and v_row.locked_until > now() then
    return query select true, v_row.locked_until;
    return;
  end if;

  if p_success then
    delete from public.login_attempts where email = v_email;
    return query select false, null::timestamptz;
    return;
  end if;

  if v_row.email is null then
    insert into public.login_attempts (email, failed_count, updated_at)
    values (v_email, 1, now());
    return query select false, null::timestamptz;
    return;
  end if;

  -- Lock expired: reset counter before counting this failure.
  if v_row.locked_until is not null and v_row.locked_until <= now() then
    v_row.failed_count := 0;
  end if;

  v_row.failed_count := v_row.failed_count + 1;

  if v_row.failed_count >= 5 then
    v_row.locked_until := now() + interval '15 minutes';
  else
    v_row.locked_until := null;
  end if;

  update public.login_attempts
    set failed_count = v_row.failed_count,
        locked_until = v_row.locked_until,
        updated_at = now()
    where email = v_email;

  return query select (v_row.locked_until is not null), v_row.locked_until;
end;
$$;

-- Allow anon (pre-login) and authenticated clients to call the RPC; the
-- function itself is the only thing that can touch login_attempts.
grant execute on function public.check_and_record_login_attempt(text, boolean) to anon, authenticated;
