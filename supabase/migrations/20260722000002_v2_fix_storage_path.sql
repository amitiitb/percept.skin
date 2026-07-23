-- Bug fix: path convention was 'v2/{user_id}/{session_id}/{photo_type}.jpg' inside
-- a bucket already named 'photos_v2' — the redundant 'v2/' prefix segment meant
-- storage.foldername(name)[1] resolved to "v2" instead of the user's id, so every
-- upload was rejected by RLS. New convention: '{user_id}/{session_id}/{photo_type}.jpg'
-- (the bucket name already provides the v2 isolation — no need to repeat it in the path).

drop policy if exists photos_v2_select on storage.objects;
drop policy if exists photos_v2_insert on storage.objects;
drop policy if exists photos_v2_delete on storage.objects;

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
