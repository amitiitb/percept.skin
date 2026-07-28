-- The pre-v2 app's on_auth_user_created trigger called handle_new_user(),
-- which did `insert into public.profiles (id) values (new.id)`. That table
-- was dropped in 20260728000000_drop_legacy_tables.sql, but the trigger
-- itself survived (Postgres doesn't validate a function body against table
-- existence until it actually runs) — so every real signup since then has
-- been failing: the trigger fires on insert into auth.users, hits
-- "relation public.profiles does not exist", the transaction aborts, and
-- GoTrue surfaces it to the client as an empty/malformed error.
--
-- v2 never relied on this trigger — user_profiles_v2 rows are created
-- explicitly from application code (the profile-setup page), not
-- automatically on signup. Safe to remove outright.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
