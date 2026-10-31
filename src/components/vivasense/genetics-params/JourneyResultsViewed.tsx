import { useEffect, useRef } from 'react';
import { recordJourney, type JourneyContext } from '@/services/history/journeyService';

/** Mounted beside results; records rendering once per attempt, including StrictMode. */
export function JourneyResultsViewed({ context }: { context: JourneyContext }) {
  const recordedAttempt = useRef<string | null>(null);
  useEffect(() => {
    if (recordedAttempt.current === context.attemptId) return;
    recordedAttempt.current = context.attemptId;
    void recordJourney('results_viewed', context);
  }, [context.attemptId, context.analysisRunId, context.design]);
  return null;
}
