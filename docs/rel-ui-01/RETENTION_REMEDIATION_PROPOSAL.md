# REL-UI-01 — data-retention remediation proposal (R1, R2, R4, R5)

Status: **PROPOSAL ONLY**. No retention behaviour has been changed. Each item
needs an approved policy (owner decision) before implementation. Item numbers
follow `PHASE_A_QUICK_ANALYSIS_AND_RETENTION.md`.

## Summary

| # | Store | Today | Proposed policy (values for approval) | Effort | Needs a DB migration |
|---|---|---|---|---|---|
| R1 | Backend in-memory dataset cache (`dataset_cache._dataset_store`): parsed upload incl. raw `base64_content` | LRU, 50 entries, **no time limit**; lost on restart | Idle TTL **2 h** and absolute TTL **24 h**, in addition to the LRU cap; explicit discard endpoint; never on disk; never logged | Small | No |
| R2 | Backend in-memory analysis cache (`_analysis_store`): full per-trait results | LRU, 500 entries, no time limit | Same TTLs as R1; evicted together with its dataset token | Small | No |
| R4 | Supabase `analysis_history` | Summary rows kept **indefinitely**; no user deletion path in the frontend | Retain **24 months** after the last activity on the account; users can delete their own rows; rows deleted on account deletion; stop copying the profile snapshot into every row | Medium | **Yes** |
| R5 | Browser `localStorage`: `vivacollect:queue:v1` (offline observation queue) and `vivasense_trials` | Kept until the user clears browser storage; the queue is **not scoped to a user** | Namespace by user id; never auto-delete unsynced observations; warn before sign-out if unsynced items exist; drop entries older than **30 days** only after they are confirmed synced; `vivasense_trials` (component not currently mounted) retired or namespaced | Small–medium | No |

## R1 / R2 — backend in-memory caches

**Risk:** on a quiet instance, uploaded research data (raw base64 and parsed
rows) and results stay in server memory with no time bound. That is not
disclosed and is longer than any workflow needs.

**Proposal:**
1. `dataset_cache`: store `created_at` and `last_access` per entry. Evict on
   access and in a cheap sweep when idle time exceeds `VIVASENSE_CACHE_IDLE_TTL_S`
   (default 7200) or age exceeds `VIVASENSE_CACHE_MAX_AGE_S` (default 86400).
   Keep the LRU caps. Evicting a dataset token also evicts its analyses.
2. `DELETE /genetics/dataset/{token}` (idempotent) for an explicit "discard
   this upload". The frontend calls it on reset or upload replacement (optional
   Phase B UI).
3. An expired token gives the existing "dataset not found, upload again"
   message, never a silent recompute from stale data.
4. Tests use a fake clock (idle expiry, absolute expiry, LRU still applies,
   analysis eviction follows the dataset). Cache keys and log lines never
   contain data.

**Scientific and persistence impact:** none. Persisted Phase 2B runs do not
depend on this cache. Relationship fingerprints are unaffected: `dataset_cache.py`
is not a fingerprinted source.

**Owner decisions:** the TTL values, and whether to state them in the privacy
notice.

## R4 — `analysis_history` (Supabase)

**Risk:**
- Rows accumulate indefinitely.
- Users cannot delete their history.
- Each row copies the user's institution, country and role, which duplicates
  personal data.
- `dataset_name` may contain identifying text.

**Proposal:**
1. **Retention:** delete rows 24 months after the account's last activity, via
   a scheduled database job. Adoption KPIs use aggregated counts that are kept
   separately.
2. **User control:** an RLS policy `delete using (user_id = auth.uid())`, plus a
   "Delete" action and a "Delete all my history" action in the history UI.
3. **Account deletion:** an `ON DELETE CASCADE` (or an equivalent job) from the
   auth user.
4. **Minimisation:** stop writing `institution`, `country` and `user_role` per
   row; join to `profiles` when needed. Existing rows are back-filled to NULL
   only after approval.
5. **Process:** a forward-only migration in source control, replayed and tested
   on the disposable stack first. **Not before P2B-RECOVERY-01 has produced a
   reproducible baseline.** No production change in this phase.

**Owner decisions:**
- the retention period;
- whether test/VALTEST rows are flagged or removed;
- what happens to the profile snapshot in historical rows.

## R5 — browser storage

**Risk:**
- On a shared device, queued field observations stay after sign-out.
- The queue is not tied to a user, so the next user's session would try to
  replay them; RLS should refuse, and the entries would then persist
  indefinitely.
- Deleting unsynced observations would lose research data, so plain expiry is
  wrong.

**Proposal:**
1. Key the queue as `vivacollect:queue:v2:<userId>`. On first load, move v1
   items into the signed-in user's queue only when their `studyId` belongs to
   that user. Otherwise keep them and show a notice.
2. Before sign-out with unsynced items: a blocking dialog ("N observations are
   not yet saved — sync now / keep on this device / discard").
3. Expiry applies only to entries already confirmed synced (older than 30
   days). Unsynced entries never expire automatically.
4. `vivasense_trials`: the `FieldDataCollection` component is not mounted
   anywhere. Retire the key, or namespace it like the queue if the component
   returns.
5. A "Data stored on this device" line in Data Capture.

**Owner decisions:**
- the sign-out behaviour;
- the synced-entry expiry period;
- whether to retire `FieldDataCollection`.

## Order of work (after approval)

1. **R1/R2:** backend only, no database involvement, testable in the cloud.
2. **R5:** frontend only, testable in the cloud.
3. **R4:** needs a migration, so it waits for P2B-RECOVERY-01 and the
   disposable-stack gates.
