-- Doctor Consultation: separate paid tier from the AI-generated Full Report
-- (report_purchases_v2). No scheduling system yet — payment just queues a
-- manual follow-up (phone/email), same pattern as report_purchases_v2:
-- one-time PayPal order capture, server-only write.

create table if not exists public.doctor_consultations_v2 (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.analysis_sessions_v2(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_phone text,
  status text not null default 'pending', -- pending | contacted | completed
  amount_paid numeric(10,2) not null,
  provider text not null default 'paypal',
  provider_order_id text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists doctor_consultations_v2_user_id_idx on public.doctor_consultations_v2(user_id);

alter table public.doctor_consultations_v2 enable row level security;
create policy doctor_consultations_v2_select on public.doctor_consultations_v2
  for select using (auth.uid() = user_id);
-- Deliberately NO insert/update/delete policy for regular users — same pattern
-- as report_purchases_v2: only the server (service role), after PayPal order
-- verification, may write a row.
