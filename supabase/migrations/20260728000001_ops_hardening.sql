-- Ops hardening: fixed-window rate limiting + persistent error log.
-- No external service required (Sentry/Upstash both need signup+keys the
-- user doesn't have yet) — this uses the Supabase project already wired up,
-- so it closes the gap now instead of waiting on that signup.

create table if not exists public.rate_limits_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  route text not null,
  window_start timestamptz not null,
  count int not null default 1,
  unique (user_id, route, window_start)
);

alter table public.rate_limits_v2 enable row level security;
-- Service-role only: rate limiting is enforced server-side, never read/written by the client directly.

create table if not exists public.error_logs_v2 (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  level text not null,
  event text not null,
  fields jsonb
);

alter table public.error_logs_v2 enable row level security;
-- Service-role only: this is an internal ops log, not user-facing data.

create index if not exists error_logs_v2_created_at_idx on public.error_logs_v2 (created_at desc);

-- Atomic increment-and-return so two concurrent requests in the same window
-- can't both read count=N and both write N+1 (lost-update race).
create or replace function public.increment_rate_limit_v2(
  p_user_id uuid,
  p_route text,
  p_window_start timestamptz
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.rate_limits_v2 (user_id, route, window_start, count)
  values (p_user_id, p_route, p_window_start, 1)
  on conflict (user_id, route, window_start)
  do update set count = rate_limits_v2.count + 1
  returning count into new_count;
  return new_count;
end;
$$;
