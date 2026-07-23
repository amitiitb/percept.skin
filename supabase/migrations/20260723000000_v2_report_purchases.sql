-- Bundle-first purchase flow: report_purchases_v2 tracks which of the 4
-- report modules (skin, colour, hairstyle, frame) a user paid for on a given
-- scan. One-time PayPal order capture, not a recurring subscription — separate
-- from subscriptions_v2 (that stays as the recurring/VIP path, untouched).

create table if not exists public.report_purchases_v2 (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions_v2(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  modules text[] not null, -- subset of ('skin','colour','hairstyle','frame')
  amount_paid numeric(10,2) not null,
  provider text not null default 'paypal',
  provider_order_id text not null,
  created_at timestamptz not null default now(),
  unique (session_id)
);
create index if not exists report_purchases_v2_user_id_idx on public.report_purchases_v2(user_id);

alter table public.report_purchases_v2 enable row level security;
create policy report_purchases_v2_select on public.report_purchases_v2
  for select using (auth.uid() = user_id);
-- Deliberately NO insert/update/delete policy for regular users — same pattern
-- as subscriptions_v2: only the server (service role), after PayPal order
-- verification, may write a purchase record.
