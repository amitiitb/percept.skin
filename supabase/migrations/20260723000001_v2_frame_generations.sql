-- AI photorealistic frame try-on (Gemini-generated), separate from the
-- real-time canvas/live-camera try-on (GlassesVirtualTryOn.tsx / LiveEyewearTryOn.tsx)
-- which stays as-is. Mirrors hairstyle_generations_v2 exactly.

create table if not exists public.frame_generations_v2 (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions_v2(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  frame_name text not null,
  storage_path text not null,
  status text not null default 'complete', -- complete | failed
  created_at timestamptz not null default now()
);
create index if not exists frame_generations_v2_session_id_idx on public.frame_generations_v2(session_id);
create index if not exists frame_generations_v2_user_id_idx on public.frame_generations_v2(user_id);

alter table public.frame_generations_v2 enable row level security;
create policy frame_generations_v2_select on public.frame_generations_v2
  for select using (auth.uid() = user_id);
create policy frame_generations_v2_insert on public.frame_generations_v2
  for insert with check (auth.uid() = user_id);
