# FE-BETA-02 — deferred items (not FE-BETA-02 blockers)

## FE-CV-01 — experimental CV% for one-factor CRD / RCBD (backend)

**Status:** deferred; backend-blocked. Not an FE-BETA-02 blocker.

The backend should expose the already governed experimental CV% in the
`/genetics/analyze-upload` response for one-factor CRD / RCBD, at
`result.descriptive_stats.cv_percent`.

Frontend position (unchanged by FE-BETA-02b):

- CV is never calculated in the browser for ANOVA results.
  `readBackendCvPercent` (`src/components/vivasense/genetics-params/feBeta02.ts`)
  reads `result.descriptive_stats.cv_percent` and nothing else, and returns
  `null` when it is absent.
- When the field is absent, the results panel simply shows no CV row. When the
  backend starts sending it, the existing support renders it as
  "Experimental CV (%)" with no frontend change.
- Evidence: none of the committed smoke-kit contract fixtures
  (`src/test/fixtures/smokeKit/VS_Smoke_0N_*.json`) carries `cv_percent`, so the
  value is currently absent in the browser. The Word report shows CV because the
  backend computes it there.

The separate Descriptive Statistics module
(`computeDescriptivePublicationTables`) is unrelated to this item and is
unchanged.
