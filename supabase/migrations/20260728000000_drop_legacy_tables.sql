-- Drop the pre-v2 legacy tables. Confirmed dead: no route or query in the
-- current codebase references sessions/reports/photos/profiles (grepped
-- app/lib/components for .from("sessions"|"reports"|"photos"|"profiles"),
-- zero hits; the old app/(legacy)/ route tree that used them is already gone
-- from the repo). All rows were emptied 2026-07-28 before this ran.
drop table if exists public.reports cascade;
drop table if exists public.photos cascade;
drop table if exists public.sessions cascade;
drop table if exists public.profiles cascade;
