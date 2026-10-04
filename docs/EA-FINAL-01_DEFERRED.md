# EA-FINAL-01 — deferred to post-Early-Access

Explicitly out of scope for EA-FINAL-01 (Recent Analyses treatment label,
factorial replication count, one-factor report Design Summary / Descriptive
Statistics). Recorded here as **post-Early-Access work only**; none was changed
in this batch.

| Item | Area |
|---|---|
| FE-CV-01 — web display of governed one-factor CV% | frontend (backend-blocked; see FE-BETA-02_DEFERRED.md) |
| Mobile report-button overflow | frontend layout |
| Footer support-email mismatch | frontend copy |
| Significance stars on replication / block rows | frontend + report presentation |
| Sticky results heading | frontend layout |
| Preview-level wording | frontend copy |
| Downloadable sample datasets | frontend / content |
| Factorial / Split-Plot "observed genotype differences" boilerplate | backend report wording |
| Tukey vs Tukey–Kramer display naming | frontend + report presentation |

Note: Recent Analyses rows for Factorial CRD recorded **before** EA-FINAL-01
stored `n_reps` as the distinct replicate-ID count (e.g. 9). Those rows now
show no rep count rather than the wrong one; rows recorded after EA-FINAL-01
store the governed `factorial_profile.replications` (e.g. 3).
