-- Needed for upsert(onConflict:...) calls in the capture flow and AI metrics
-- persistence: a retake or a re-run must overwrite the same row, not duplicate it.

alter table public.analysis_photos_v2
  add constraint analysis_photos_v2_session_phototype_key unique (session_id, photo_type);

alter table public.analysis_metrics_v2
  add constraint analysis_metrics_v2_session_metric_key unique (session_id, category, metric_name);

alter table public.user_profiles_v2
  add constraint user_profiles_v2_user_id_key unique (user_id);

alter table public.subscriptions_v2
  add constraint subscriptions_v2_user_id_key unique (user_id);
