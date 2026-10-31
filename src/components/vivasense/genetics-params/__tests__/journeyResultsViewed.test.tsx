import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/services/history/journeyService', () => ({ recordJourney: vi.fn() }));
import { recordJourney } from '@/services/history/journeyService';
import { JourneyResultsViewed } from '../JourneyResultsViewed';
describe('results rendered tracking', () => {
  it('records once in StrictMode and separately for a new analysis attempt', () => {
    vi.clearAllMocks();
    const { rerender } = render(<StrictMode><JourneyResultsViewed context={{ attemptId: 'first' }} /></StrictMode>);
    expect(recordJourney).toHaveBeenCalledTimes(1);
    rerender(<StrictMode><JourneyResultsViewed context={{ attemptId: 'first' }} /></StrictMode>);
    expect(recordJourney).toHaveBeenCalledTimes(1);
    rerender(<StrictMode><JourneyResultsViewed context={{ attemptId: 'second' }} /></StrictMode>);
    expect(recordJourney).toHaveBeenCalledTimes(2);
  });
});
