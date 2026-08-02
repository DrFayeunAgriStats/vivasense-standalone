# VivaSense Standalone — Row Level Security

Every table has RLS **enabled** with owner-scoped policies. Isolation derives
from Supabase Auth (`auth.uid()`); there is no shared/global read path and no
FIA role model. Default pattern: a row is visible/writable only to the user who
owns it (directly via `user_id`, or transitively via the parent `studies` row).

| Table | Policy | Command | Rule |
|---|---|---|---|
| `profiles` | `profiles_select_own` | SELECT | `auth.uid() = id` |
| `profiles` | `profiles_insert_own` | INSERT | `auth.uid() = id` |
| `profiles` | `profiles_update_own` | UPDATE | `auth.uid() = id` (both `using` + `with check`) |
| `studies` | `studies_own_all` | ALL | `auth.uid() = user_id` |
| `trait_definitions` | `trait_definitions_own_all` | ALL | parent study owned: `exists (select 1 from studies s where s.id = study_id and s.user_id = auth.uid())` |
| `plots` | `plots_own_all` | ALL | parent study owned (as above) |
| `observations` | `observations_own_all` | ALL | parent study owned (as above) |
| `plot_notes` | `plot_notes_own_all` | ALL | parent study owned (as above) |
| `plot_photos` | `plot_photos_own_all` | ALL | parent study owned (as above) |
| `analysis_history` | `analysis_history_own_select/insert/update/delete` | per-command | `auth.uid() = user_id` |
| `storage.objects` (bucket `plot-photos`) | `plot_photos_insert/select/delete_own` | INSERT/SELECT/DELETE | `bucket_id = 'plot-photos' and owner = auth.uid()` |

## Notes & deliberate decisions

- **`profiles` has no DELETE policy.** Profiles are removed only by the
  `on delete cascade` from `auth.users` — users cannot delete their profile row
  directly.
- **`is_admin` cannot be self-granted.** Although `profiles_update_own` allows a
  user to update their own row, the `protect_profile_privileges` BEFORE UPDATE
  trigger (migration 001) reverts any `is_admin` change coming from a PostgREST
  request (`role` = `authenticated`/`anon`). Admin is granted only via the
  service role or SQL editor (see `seed.sql`). This replaces FIA's `user_roles`.
- **Auto-provision insert** of a profile happens in the `handle_new_user`
  `SECURITY DEFINER` trigger, which bypasses RLS; `profiles_insert_own` is a
  fallback for client-side upserts.
- **Child-table policies** intentionally re-check study ownership on every
  command via an `exists (... studies ...)` subquery, so re-parenting a row to
  someone else's study is impossible (fails the `with check`).
- **No cross-user or public read** exists anywhere in Phase 1. Any future
  sharing feature must add an explicit, separate policy — it will not happen by
  omission.

## Verifying
After `supabase db push`, in the dashboard **Authentication → Policies** confirm
each table above lists its policy and shows RLS as **Enabled**. A quick smoke
test: sign in as user A, create a study; sign in as user B; confirm B cannot
`select` A's study, plots, observations, or analysis_history rows.
