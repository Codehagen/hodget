-- Waitlist confidentiality: the table is written with the PUBLIC anon key
-- from a server action, so RLS is the only thing standing between the anon
-- key and a dump of every signup email. Insert-only for anon; no select,
-- update, or delete for anon/authenticated.
alter table public.waitlist enable row level security;

drop policy if exists waitlist_insert_anon on public.waitlist;
create policy waitlist_insert_anon
  on public.waitlist for insert
  to anon, authenticated
  with check (true);
-- Deliberately NO select/update/delete policies: with RLS enabled and no
-- policy, those operations are denied for anon/authenticated.
