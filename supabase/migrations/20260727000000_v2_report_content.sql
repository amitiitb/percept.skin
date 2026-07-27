-- Persist the AI-generated positive observations, skincare/haircare
-- recommendations, and limitations that lib/v2/aiProvider.ts already
-- returns on every analysis but /api/v2/analyse silently discards (only
-- overall_score and skin_age were ever saved). This is the most
-- personalized, genuinely valuable part of the AI's output — a real
-- morning/evening/weekly routine, not just scored metrics — and it never
-- reached the report page.
alter table public.analysis_sessions_v2
  add column if not exists positive_observations text[] default '{}',
  add column if not exists priority_concerns text[] default '{}',
  add column if not exists recommendations jsonb,
  add column if not exists limitations text[] default '{}';
