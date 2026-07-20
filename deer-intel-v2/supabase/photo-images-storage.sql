-- Photo image cloud backup (see lib/cloudImages.ts).
--
-- Photo *records* sync as JSONB via deer_intel_state, but the image blobs live
-- in each device's IndexedDB, which the browser can evict. This private bucket
-- backs up every saved image at "{user_id}/{imageId}" so it survives eviction
-- and appears on all of a user's devices. RLS mirrors deer_intel_state: each
-- user can only touch objects under their own uid folder.
--
-- Applied to the Deer Intel project as migration photo_images_storage_bucket.

insert into storage.buckets (id, name, public)
values ('photo-images', 'photo-images', false)
on conflict (id) do nothing;

create policy "Users can read their own photo images"
  on storage.objects for select
  using (
    bucket_id = 'photo-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can upload their own photo images"
  on storage.objects for insert
  with check (
    bucket_id = 'photo-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own photo images"
  on storage.objects for update
  using (
    bucket_id = 'photo-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own photo images"
  on storage.objects for delete
  using (
    bucket_id = 'photo-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
