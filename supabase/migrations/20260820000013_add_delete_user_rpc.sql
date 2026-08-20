-- AC-AUTH-12: account deletion. UserProfile.tsx calls rpc('delete_user') but
-- no such function existed anywhere in the schema -- the RPC call silently
-- errored (caught, logged, then app still signed out and told the user
-- "Akun berhasil dihapus"), so no server data was ever actually deleted.
-- All user-owned tables reference auth.users(id) on delete cascade, so
-- deleting the auth.users row is sufficient to wipe everything.

create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_user() to authenticated;
