import { describe, expect, it, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), insert: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.getSession }, from: mocks.from } }));
import { recordJourney } from '../journeyService';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner' } } } });
  mocks.insert.mockResolvedValue({ error: null });
});
describe('journey recording', () => {
  it('uses session identity and links the exact attempt and durable run', async () => {
    await recordJourney('report_download_initiated', { attemptId: 'attempt', analysisRunId: 'run', design: 'rcbd' });
    expect(mocks.insert).toHaveBeenCalledWith({ user_id: 'owner', attempt_id: 'attempt', analysis_run_id: 'run', event_type: 'report_download_initiated', design_type: 'rcbd' });
  });
  it('does not write when signed out', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    await recordJourney('analysis_started', { attemptId: 'attempt' });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it('cannot interrupt report delivery on a database or transport failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.insert.mockRejectedValue(new Error('offline'));
    await expect(recordJourney('report_download_failed', { attemptId: 'attempt' })).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
