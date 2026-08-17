-- Safety net: lets a background sweep tell which purchases still need their
-- "report ready" email, for sessions where the browser closed before the
-- client-driven prepare flow reached its final step.
alter table public.report_purchases_v2
  add column if not exists emailed_at timestamptz;
