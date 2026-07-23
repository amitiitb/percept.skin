-- Cherry-picked additions: colour analysis port + Gemini hairstyle suggestions.
-- Same isolation pattern as the rest of v2 (own tables, RLS via user_id, same
-- denormalization approach as analysis_photos_v2/analysis_metrics_v2 since
-- both are keyed by session_id).

create table if not exists public.colour_analysis_v2 (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions_v2(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null, -- full ColourAnalysis shape (season, undertone, best_colours, etc.)
  created_at timestamptz not null default now(),
  unique (session_id)
);
create index if not exists colour_analysis_v2_user_id_idx on public.colour_analysis_v2(user_id);

alter table public.colour_analysis_v2 enable row level security;
create policy colour_analysis_v2_select on public.colour_analysis_v2
  for select using (auth.uid() = user_id);
create policy colour_analysis_v2_insert on public.colour_analysis_v2
  for insert with check (auth.uid() = user_id);
create policy colour_analysis_v2_update on public.colour_analysis_v2
  for update using (auth.uid() = user_id);

create table if not exists public.hairstyle_generations_v2 (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions_v2(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  style_name text not null,
  storage_path text not null, -- photos_v2 bucket, {user_id}/{session_id}/hairstyle-{style}.jpg
  status text not null default 'complete', -- complete | failed
  created_at timestamptz not null default now()
);
create index if not exists hairstyle_generations_v2_session_id_idx on public.hairstyle_generations_v2(session_id);
create index if not exists hairstyle_generations_v2_user_id_idx on public.hairstyle_generations_v2(user_id);

alter table public.hairstyle_generations_v2 enable row level security;
create policy hairstyle_generations_v2_select on public.hairstyle_generations_v2
  for select using (auth.uid() = user_id);
create policy hairstyle_generations_v2_insert on public.hairstyle_generations_v2
  for insert with check (auth.uid() = user_id);
