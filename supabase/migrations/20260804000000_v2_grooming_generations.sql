-- Simulate: beard style previews (AI-generated grid, same pattern as
-- hairstyle_generations_v2). `kind` stays a checked column (not just
-- 'beard' hardcoded) so a future grooming preview type can reuse this table
-- without a new migration — an eyebrow-shape version was tried and dropped
-- (see lib/v2/gemini.ts), but the table shape doesn't need to know that.

create table if not exists public.grooming_generations_v2 (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions_v2(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('beard')),
  storage_path text not null, -- photos_v2 bucket, {user_id}/{session_id}/{kind}-grid.jpg
  status text not null default 'complete', -- complete | failed
  created_at timestamptz not null default now()
);
create index if not exists grooming_generations_v2_session_id_idx on public.grooming_generations_v2(session_id);
create index if not exists grooming_generations_v2_user_id_idx on public.grooming_generations_v2(user_id);

alter table public.grooming_generations_v2 enable row level security;
create policy grooming_generations_v2_select on public.grooming_generations_v2
  for select using (auth.uid() = user_id);
create policy grooming_generations_v2_insert on public.grooming_generations_v2
  for insert with check (auth.uid() = user_id);
