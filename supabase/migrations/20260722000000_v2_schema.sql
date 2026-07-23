-- Glowmetry V2 — Phase 1 schema (T1 + T2 from docs/V2_PLAN.md)
-- New tables, isolated from the live app's `sessions`/`reports`/`photos` tables and bucket.
-- Decisions applied: #6 (DB-level RLS on all tables), #7 (denormalized user_id on
-- session_id-keyed child tables), #8 (storage path convention).

-- ============================================================
-- user_profiles_v2
-- ============================================================
create table if not exists public.user_profiles_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  age_range text,
  date_of_birth date,
  gender text,
  country text,
  skin_type text,
  skin_concerns text[] default '{}',
  hair_type text,
  hair_concerns text[] default '{}',
  current_routine text,
  subscription_status text not null default 'free',
  subscription_plan text,
  consent_given boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_profiles_v2_user_id_idx on public.user_profiles_v2(user_id);

alter table public.user_profiles_v2 enable row level security;
create policy user_profiles_v2_select on public.user_profiles_v2
  for select using (auth.uid() = user_id);
create policy user_profiles_v2_insert on public.user_profiles_v2
  for insert with check (auth.uid() = user_id);
create policy user_profiles_v2_update on public.user_profiles_v2
  for update using (auth.uid() = user_id);
create policy user_profiles_v2_delete on public.user_profiles_v2
  for delete using (auth.uid() = user_id);

-- ============================================================
-- analysis_sessions_v2
-- ============================================================
create table if not exists public.analysis_sessions_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending', -- pending | capturing | analyzing | complete | failed
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  overall_score integer,
  skin_age integer,
  image_quality_score integer,
  report_version text not null default 'v2',
  created_at timestamptz not null default now()
);
create index if not exists analysis_sessions_v2_user_id_idx on public.analysis_sessions_v2(user_id);

alter table public.analysis_sessions_v2 enable row level security;
create policy analysis_sessions_v2_select on public.analysis_sessions_v2
  for select using (auth.uid() = user_id);
create policy analysis_sessions_v2_insert on public.analysis_sessions_v2
  for insert with check (auth.uid() = user_id);
create policy analysis_sessions_v2_update on public.analysis_sessions_v2
  for update using (auth.uid() = user_id);
create policy analysis_sessions_v2_delete on public.analysis_sessions_v2
  for delete using (auth.uid() = user_id);

-- ============================================================
-- analysis_photos_v2
-- Decision #7: denormalized user_id (this table is keyed by session_id, not
-- user_id — a subquery-through-parent RLS policy was rejected as slower/more
-- complex; instead user_id is copied at insert time from the parent session).
-- ============================================================
create table if not exists public.analysis_photos_v2 (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions_v2(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_type text not null, -- e.g. 'front', 'left', 'forehead', 'hairline_front', etc (15 types per spec)
  storage_path text not null, -- v2/{user_id}/{session_id}/{photo_type}.jpg (Decision #8)
  quality_status text not null default 'pending', -- pending | passed | failed
  quality_issues text[] default '{}',
  created_at timestamptz not null default now()
);
create index if not exists analysis_photos_v2_session_id_idx on public.analysis_photos_v2(session_id);
create index if not exists analysis_photos_v2_user_id_idx on public.analysis_photos_v2(user_id);

alter table public.analysis_photos_v2 enable row level security;
create policy analysis_photos_v2_select on public.analysis_photos_v2
  for select using (auth.uid() = user_id);
create policy analysis_photos_v2_insert on public.analysis_photos_v2
  for insert with check (auth.uid() = user_id);
create policy analysis_photos_v2_update on public.analysis_photos_v2
  for update using (auth.uid() = user_id);
create policy analysis_photos_v2_delete on public.analysis_photos_v2
  for delete using (auth.uid() = user_id);

-- ============================================================
-- analysis_metrics_v2
-- Decision #7: same denormalized user_id pattern as analysis_photos_v2.
-- ============================================================
create table if not exists public.analysis_metrics_v2 (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions_v2(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('skin', 'face', 'hair')),
  metric_name text not null,
  score integer,
  label text, -- e.g. "Excellent" | "Good" | "Moderate" | "Needs attention"
  confidence text, -- image-quality-driven confidence note
  explanation text,
  recommendation text,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists analysis_metrics_v2_session_id_idx on public.analysis_metrics_v2(session_id);
create index if not exists analysis_metrics_v2_user_id_idx on public.analysis_metrics_v2(user_id);

alter table public.analysis_metrics_v2 enable row level security;
create policy analysis_metrics_v2_select on public.analysis_metrics_v2
  for select using (auth.uid() = user_id);
create policy analysis_metrics_v2_insert on public.analysis_metrics_v2
  for insert with check (auth.uid() = user_id);
create policy analysis_metrics_v2_update on public.analysis_metrics_v2
  for update using (auth.uid() = user_id);
create policy analysis_metrics_v2_delete on public.analysis_metrics_v2
  for delete using (auth.uid() = user_id);

-- ============================================================
-- subscriptions_v2
-- ============================================================
create table if not exists public.subscriptions_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'paypal',
  provider_customer_id text,
  provider_subscription_id text,
  plan text, -- monthly | quarterly | annual
  status text not null default 'inactive', -- inactive | active | cancelled | past_due
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_v2_user_id_idx on public.subscriptions_v2(user_id);

alter table public.subscriptions_v2 enable row level security;
create policy subscriptions_v2_select on public.subscriptions_v2
  for select using (auth.uid() = user_id);
-- Deliberately NO insert/update/delete policy for regular users — subscription
-- status must only ever be written by the server (service role) after PayPal
-- order verification (Decision #3), never directly by the client.

-- ============================================================
-- Storage bucket: photos_v2 (Decision #8)
-- Path convention: v2/{user_id}/{session_id}/{photo_type}.jpg
-- ============================================================
insert into storage.buckets (id, name, public)
values ('photos_v2', 'photos_v2', false)
on conflict (id) do nothing;

create policy photos_v2_select on storage.objects
  for select using (
    bucket_id = 'photos_v2'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy photos_v2_insert on storage.objects
  for insert with check (
    bucket_id = 'photos_v2'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy photos_v2_delete on storage.objects
  for delete using (
    bucket_id = 'photos_v2'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
