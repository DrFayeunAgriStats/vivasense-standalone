#!/usr/bin/env bash
# ============================================================================
# VivaSense Standalone — Supabase provisioning (scripted steps)
#
# Runs the CLI-scriptable parts of supabase/PROVISIONING.md:
#   link → db push (migrations 001–006) → deploy edge fn → set secret
#
# The manual/dashboard steps (create project, auth URLs, Vercel env, smoke test)
# are NOT done here — see PROVISIONING.md.
#
# Usage (from repo root):
#   export SUPABASE_PROJECT_REF=<reference-id>
#   export ANTHROPIC_API_KEY=sk-ant-...
#   bash supabase/provision.sh
#
# Idempotent: safe to re-run. Migrations use IF NOT EXISTS; secrets/deploys upsert.
# ============================================================================
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF to the project Reference ID (Settings -> General)}"
: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY (server-side secret for vivasense-interpret)}"

command -v supabase >/dev/null 2>&1 || { echo "ERROR: supabase CLI not found. npm i -g supabase"; exit 1; }

# Run from the repo root (this script lives in supabase/).
cd "$(dirname "$0")/.."

echo "==> 1/4  Linking project $SUPABASE_PROJECT_REF"
supabase link --project-ref "$SUPABASE_PROJECT_REF"

echo "==> 2/4  Pushing migrations (schema, RLS, storage bucket)"
supabase db push

echo "==> 3/4  Deploying edge function: vivasense-interpret"
supabase functions deploy vivasense-interpret

echo "==> 4/4  Setting ANTHROPIC_API_KEY secret"
supabase secrets set "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY"

cat <<'DONE'

✓ Scripted provisioning complete.

Still MANUAL (see supabase/PROVISIONING.md):
  • Auth → URL Configuration: Site URL + redirect allow-list (/workspace, /update-password)
  • Vercel env: VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY, then redeploy
  • Verify Vercel promoted to Production (not Preview)
  • Acceptance smoke test (register → … → interpretation), incl. two-user RLS check
DONE
