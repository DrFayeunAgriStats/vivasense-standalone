import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn(), event: vi.fn(), session: vi.fn() }));
vi.mock('@/services/history/journeyService', () => ({ recordJourney: mocks.event }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.session } } }));
vi.mock('@/services/vivasenseApiClient', () => ({ vivaSenseRequest: mocks.request }));
import { downloadPersistentRcbdReport } from '@/services/persistenceRcbdApi';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'owner' }, access_token: 'test' } } });
  mocks.request.mockResolvedValue(new Blob(['report']));
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});
describe('persistent report activity', () => {
  it('records download handoff only after receiving a report and clicking the download', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await downloadPersistentRcbdReport('run', 'report.docx', 'general', 'attempt');
    expect(click).toHaveBeenCalledTimes(1);
    expect(mocks.event.mock.calls.map(c => c[0])).toEqual(['report_download_requested', 'report_download_initiated']);
    expect(mocks.event).toHaveBeenLastCalledWith('report_download_initiated', { attemptId: 'attempt', analysisRunId: 'run', design: 'rcbd' });
    click.mockRestore();
  });
  it('records failure and preserves the original error without a successful handoff event', async () => {
    mocks.request.mockRejectedValue(new Error('report refused'));
    await expect(downloadPersistentRcbdReport('run', 'report.docx', 'general', 'attempt')).rejects.toThrow('report refused');
    expect(mocks.event.mock.calls.map(c => c[0])).toEqual(['report_download_requested', 'report_download_failed']);
  });
});
