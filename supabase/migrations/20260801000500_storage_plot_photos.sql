-- ============================================================================
-- VivaSense Standalone — 005 · Storage: plot-photos bucket
--
-- Private bucket for field data-capture photos. Access is via signed URLs
-- (createSignedUrl, 1 h). Objects are owner-scoped: a user may only read/write/
-- delete objects they own. Bytes are referenced from public.plot_photos.storage_path.
--
-- NOTE: dataset uploads for statistical analysis do NOT use Storage — the
-- frontend sends the file to the FastAPI + R backend as base64 and never
-- persists it in Supabase, so no `datasets` bucket is provisioned in Phase 1
-- (see supabase/storage.md).
--
-- Idempotent (safe to re-run).
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('plot-photos', 'plot-photos', false)
  on conflict (id) do nothing;

drop policy if exists "plot_photos_insert_own" on storage.objects;
create policy "plot_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'plot-photos' and owner = auth.uid());

drop policy if exists "plot_photos_select_own" on storage.objects;
create policy "plot_photos_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'plot-photos' and owner = auth.uid());

drop policy if exists "plot_photos_delete_own" on storage.objects;
create policy "plot_photos_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'plot-photos' and owner = auth.uid());
