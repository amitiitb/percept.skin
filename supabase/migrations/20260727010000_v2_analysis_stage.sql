alter table public.analysis_sessions_v2
  add column if not exists stage text,
  add column if not exists fail_reason text,
  add column if not exists stage_updated_at timestamptz;
