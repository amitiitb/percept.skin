-- Lets a user delete any scan from their history, including a completed one
-- with a paid report attached, without losing the purchase record.
--
-- report_purchases_v2.session_id was `not null references
-- analysis_sessions_v2(id) on delete cascade` — deleting a completed session
-- would silently delete its purchase row too (amount paid, provider order id,
-- which modules were bought), destroying real payment/accounting history.
-- Switching to `on delete set null` (the same pattern doctor_consultations_v2
-- already uses) means deleting the scan only unlinks the purchase from a
-- session; the purchase row, and everything it records, survives.

alter table public.report_purchases_v2
  drop constraint if exists report_purchases_v2_session_id_fkey;

alter table public.report_purchases_v2
  alter column session_id drop not null;

alter table public.report_purchases_v2
  add constraint report_purchases_v2_session_id_fkey
  foreign key (session_id) references public.analysis_sessions_v2(id) on delete set null;
