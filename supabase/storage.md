# VivaSense Standalone — Storage

## Buckets

### `plot-photos` (private)
- **Provisioned by:** `migrations/20260801000500_storage_plot_photos.sql`
- **Visibility:** private (`public = false`) — never served by public URL.
- **Access pattern:** the frontend uploads with `supabase.storage.from('plot-photos').upload(path, file)` and reads via `createSignedUrl(path, 3600)` (1-hour signed URLs). Referenced from `code`: `src/services/dataCapture/dataCaptureService.ts` (`PHOTO_BUCKET = "plot-photos"`).
- **Object policies (RLS on `storage.objects`):** insert / select / delete are all restricted to `bucket_id = 'plot-photos' AND owner = auth.uid()` for the `authenticated` role. A user can only touch photos they uploaded.
- **DB linkage:** object keys are recorded in `public.plot_photos.storage_path`; that table's RLS scopes rows to the owning study.

## Deliberately NOT provisioned

### Dataset uploads → no bucket
Statistical analysis datasets (CSV/XLSX) are **not** stored in Supabase Storage.
The upload flow (`src/services/geneticsUploadApi.ts`, `src/lib/geneticsUploadApi.ts`)
encodes the file as base64 and POSTs it directly to the FastAPI + R backend
(`VITE_API_URL`, e.g. `/genetics/upload-preview`, `/genetics/analyze-upload`).
No dataset bytes are persisted in the VivaSense project, so no `datasets` bucket
is created in Phase 1.

**Phase 2 consideration:** if server-side dataset retention / re-analysis is
added, introduce a private `datasets` bucket with the same owner-scoped policy
pattern as `plot-photos`, plus a `datasets` metadata table linked to `studies`.

## Manual step after provisioning
Storage buckets and their policies are created by the migration above, so
`supabase db push` (or `db reset`) is sufficient — no dashboard clicks required.
Verify in **Storage → Policies** that the three `plot_photos_*_own` policies are
present after the first deploy.
