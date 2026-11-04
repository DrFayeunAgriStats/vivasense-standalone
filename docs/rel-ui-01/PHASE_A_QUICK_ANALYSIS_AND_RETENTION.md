# REL-UI-01 Phase A — quick-analysis Word report and data-retention audit

Branch `rel-ui-01-phase-a-20261104`, based on the frozen REL-OPEN-01 frontend
`5f46b61`. Cloud-only work (2026-11-04); no database or deployment involved.
Release verdict: NOT READY.

## 1. Quick-analysis Word report (implemented)

**Finding (before):** the Relationship page offered no Word report. The only
client helper, `exportCorrelationWord` in `src/services/traitRelationshipsApi.ts`,
is unused, and its response normaliser drops `result_integrity`, `pair_results`,
`multiplicity`, `analysis_context` and other governed fields. The backend
(`/export/correlation-word`, frozen backend `bae1d0d`, tests
`test_rel_sci_export.py`) stamps an unsealed payload UNVERIFIED and refuses
altered statistics with 422, so that helper could only ever produce an
unverified or misleading report. It is left untouched (not used) in this phase.

**Change:**
- `src/lib/relationshipWordExport.ts` sends the `/genetics/correlation`
  response exactly as received (detached JSON copy) to
  `POST /export/correlation-word`, `responseType: "blob"`. A result without a
  seal is never sent.
- `src/pages/RelationshipAnalysis.tsx`: a "Download Word report" control on
  the results, labelled as a quick analysis not saved to a study; disabled with
  an explanation when there is no seal; a backend refusal is shown verbatim
  under "The Word report was not generated". Reset with the analysis.
- No change to request building, A1/A1b controls, scientific display, or the
  backend.

**Tests (no database):** `relationshipWordExport.test.ts` (7) and three new
page tests in `RelationshipAnalysis.governed.test.tsx` (9 total): exact
sealed payload sent; unsealed → disabled, no request; integrity refusal shown
verbatim, nothing saved.

**Not yet verified:** a real browser download against a running backend
(staging E2E). The backend's verification of a browser-serialised payload is
covered by the backend test `test_rel_sci_16_browser_number_roundtrip_still_verifies`.

## 2. Data-retention audit (findings; no code change)

| # | Where | What is retained | Bound | Assessment |
|---|---|---|---|---|
| R1 | Backend `dataset_cache._dataset_store` | Parsed upload context incl. raw `base64_content`, keyed by dataset token | In-memory LRU, 50 datasets; no time limit; lost on restart; not on disk | **Open:** raw research data can stay in server memory indefinitely on a quiet instance. Needs a documented policy or a TTL. |
| R2 | Backend `dataset_cache._analysis_store` | Full per-trait analysis responses | In-memory LRU, 500 entries; no time limit | Same as R1. |
| R3 | `/genetics/correlation` (quick Relationship) | Nothing persisted server-side; the result returns to the browser only | — | OK. Word report is regenerated from the posted, sealed payload; nothing stored. |
| R4 | Supabase `analysis_history` via `historyService.recordAnalysis` | Summary row: user id, type, dataset name and token, trait names, parameters, headline metrics, profile institution, country and role. Never the full response (`historyTypes.ts`). | Indefinite (no deletion path found in the frontend) | **Open:** retention period and user deletion are undefined. The Relationship page records no history; Trait Association does. |
| R5 | `localStorage` `vivasense_trials` (FieldDataCollection) and `vivacollect:queue:v1` (offline queue) | Field observations entered in the browser | Until the user clears browser storage | **Open:** research data persisted on shared devices; no expiry or clear-on-sign-out found. |
| R6 | `localStorage` RCBD dataset-id cache (`persistenceRcbdApi.ts`) | Dataset identifiers only | Until cleared or invalid | Low risk. |
| R7 | Browser console | `traitRelationshipsApi.ts` logs response keys and trait names (3 `console.log` calls); not used by the Relationship page | Session | Low; remove when the helper is retired. |

Recommended Phase B decisions (owner decisions, not implemented): retention
period and TTL for R1 and R2; retention period and user deletion for R4;
clear-on-sign-out or expiry for R5; retire `exportCorrelationWord` (R7).
