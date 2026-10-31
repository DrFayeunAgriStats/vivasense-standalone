
export type JourneyEvent = 'analysis_started' | 'analysis_succeeded' | 'analysis_partially_succeeded' | 'analysis_failed' | 'results_viewed' | 'report_download_requested' | 'report_download_initiated' | 'report_download_failed';
export interface JourneyContext {
  attemptId: string;
  analysisRunId?: string | null;
  design?: string | null;
}

/** Best-effort browser observations, never a scientific validation or proof a file was read. */
export async function recordJourney(event: JourneyEvent, context: JourneyContext): Promise<void> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return;
    // Narrow cast until generated database types include this additive migration.
    const { error } = await supabase.from('analysis_journey_events' as never).insert({
      user_id: data.session.user.id,
      attempt_id: context.attemptId,
      analysis_run_id: context.analysisRunId ?? null,
      event_type: event,
      design_type: context.design ?? null,
    } as never);
    if (error) console.warn('[journey] Event could not be recorded');
  } catch {
    // Telemetry must never interrupt analysis or report delivery.
    console.warn('[journey] Event could not be recorded');
  }
}
