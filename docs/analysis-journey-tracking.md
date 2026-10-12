# Analysis journey observations

Initial coverage: governed ANOVA (CRD, RCBD, factorial CRD/RCBD, split-plot RCBD), restored persistent RCBD results, and persistent RCBD downloads from history. Other modules are not yet instrumented.

Events: analysis_started, analysis_succeeded, analysis_partially_succeeded, analysis_failed, results_viewed, report_download_requested, report_download_initiated, report_download_failed.

An attempt UUID is generated per analysis click. The same UUID is stored in analysis_history.analysis_parameters.journey_attempt_id and every journey event; persistent results additionally link analysis_run_id. Restoring results uses a fresh viewing attempt and retains the durable run ID. A history download has its own download attempt and durable run ID.

results_viewed means the results component rendered, not that the person read it. report_download_initiated means the report response was received and handed to the browser's download mechanism, not saved, opened or read. These best-effort client events can be lost on network failure or tab closure and must not be used as an audit of statistical correctness. Event ordering should be interpreted by attempt and event type; non-blocking writes may arrive out of order. No past events are backfilled.

Only authenticated users can insert and read their own rows. Run links must belong to the same user. No client update/delete access; no anonymous access. Administrative support inspection uses authorised server-side tooling, not a privileged browser key. Events contain identity, timestamp, attempt/run IDs and design name; no research values, filenames, report text or export tokens.

Support query (parameterise the selected user ID):

```sql
select attempt_id, analysis_run_id, event_type, design_type,
       created_at at time zone 'Africa/Lagos' as time_wat
from public.analysis_journey_events
where user_id = :user_id
order by created_at desc
limit 100;
```

Deployment: apply the additive migration before deploying the frontend. Statistical and report requests are unchanged. Include usage-event collection in the platform privacy notice and establish a retention policy before wider rollout.
