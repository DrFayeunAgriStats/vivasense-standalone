# VivaSense Standalone — Supabase Provisioning Runbook

Stand up the dedicated VivaSense Supabase project and point the app at it.
Deploying the frontend does **not** do this — the migrations and edge function
are just files until you run the steps below. Until then production keeps using
the shared FIA project.

Estimated time: ~15 minutes. Steps 1, 3, 6, 7 are dashboard/manual; steps 2, 4, 5
are scripted by [`provision.sh`](./provision.sh).

---

## 0. Prerequisites
- Supabase CLI ≥ 1.180 — `npm i -g supabase` (or `scoop install supabase`), then `supabase --version`.
- Access to the VivaSense Supabase org and the Vercel project.
- An Anthropic API key for the interpretation edge function.

```bash
supabase login          # opens a browser once
```

## 1. Create the project (dashboard — manual)
1. https://supabase.com/dashboard → **New project** (VivaSense org).
2. Name `vivasense`, set a strong DB password (save it), pick the region closest to your users.
3. When it's ready, copy from **Project Settings → API**:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **Reference ID** (Settings → General) → the `--project-ref`

## 2. Link + push the schema (scripted)
From the repo root:
```bash
export SUPABASE_PROJECT_REF=<reference-id>
export ANTHROPIC_API_KEY=sk-ant-...        # for step 4
bash supabase/provision.sh
```
`provision.sh` runs, in order:
- `supabase link --project-ref $SUPABASE_PROJECT_REF`
- `supabase db push` — applies migrations **001–006** (profiles + trigger + is_admin guard, studies, data-capture, analysis_history link, plot-photos bucket + storage RLS, onboarding column).
- `supabase functions deploy vivasense-interpret`
- `supabase secrets set ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY`

> `seed.sql` is intentionally empty (clean start, no data migrated), so there is
> nothing to seed. Grant yourself admin **after** registering (step 7).

Prefer to run it by hand instead of the script? The four commands above are all it does.

## 3. Configure Auth (dashboard — manual)
**Authentication → URL Configuration:**
- **Site URL:** your production origin, e.g. `https://vivasensestat.com`
- **Redirect URLs (allow-list):** add every origin the app runs on, plus the paths the code redirects to:
  - `https://vivasensestat.com/workspace`
  - `https://vivasensestat.com/update-password`
  - `http://localhost:5173/workspace`, `http://localhost:5173/update-password` (local dev)

  (Registration uses `emailRedirectTo = <origin>/workspace`; password reset uses `<origin>/update-password`.)
- **Authentication → Providers → Email:** keep "Confirm email" **on** (the register flow shows a "check your email" screen and expects confirmation).

## 4. Edge function secret
Handled by `provision.sh`. To verify:
```bash
supabase secrets list        # ANTHROPIC_API_KEY should be present
```
`vivasense-interpret` is deployed with `verify_jwt = false` (see `config.toml`) — it's a public streaming endpoint that reads no user rows.

## 5. Point the frontend at the new project
**Vercel → Project → Settings → Environment Variables** (Production, and Preview if used):
```
VITE_SUPABASE_URL             = https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY = <anon key>
```
Leave `VITE_API_URL` unchanged (the FastAPI + R compute backend has no Supabase dependency).
Then **redeploy** so the new env is baked into the bundle (Vite inlines `VITE_*` at build time — a redeploy is required; changing env alone doesn't update a built bundle).

For local dev, update `.env.local` to match, then `npm run dev`.

## 6. Verify the deploy actually promoted (Vercel gotcha)
A `master` push can land as **Preview**, not Production. In the Vercel dashboard confirm the **Production** deployment updated and the live bundle hash changed.

## 7. Acceptance smoke test (against the new project)
Walk the full flow on the deployed app and confirm each step:
1. **Register** a new account → "check your email" screen; confirm via the email link.
2. **Login** → lands on `/workspace`.
3. In Supabase **Table editor → profiles**: a row exists for the new user (auto-provisioned by the trigger) with full_name / institution / position / research_area.
4. **Create Study → Define Traits → Create Plots** (via `/data-capture`).
5. **Upload dataset → Run Analysis** (ANOVA) → result renders.
6. **analysis_history** row appears (Table editor); re-open `/workspace` shows it under Recent Analyses.
7. **Generate interpretation** (R backend narrative) renders.
8. Open **`/workspace-v2`** → stepper, active study, recent analyses populate from real data; dismiss onboarding, reload → stays dismissed (persisted to `profiles.onboarding_dismissed`).
9. **RLS check:** register a second user; confirm they cannot see the first user's studies/analyses.

Grant yourself admin (optional), via the SQL editor (the API can't set this — privilege guard):
```sql
update public.profiles set is_admin = true where email = 'you@example.org';
```

## Rollback
- **Frontend:** revert the Vercel env vars to the FIA project and redeploy — the code is backward-compatible with the old schema.
- **Data:** none created here beyond real users; the new project can simply be paused/deleted if abandoned.

## What is NOT provisioned (Phase 2)
Pro Access / licensing / access codes / billing / subscriptions — no tables,
no `vivasense-pro-redeem` function. `featureMode` runs all-features-permitted.
