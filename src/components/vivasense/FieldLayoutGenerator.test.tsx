import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn(), download: vi.fn() }));
vi.mock('@/services/vivasenseApiClient', () => ({ vivaSenseRequest: mocks.request }));
vi.mock('@/lib/fieldBookExport', () => ({ downloadFieldBook: mocks.download }));
import { FieldLayoutGenerator } from './FieldLayoutGenerator';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.request.mockResolvedValue({ design_type: 'factorial_rcbd', seed: 42,
    plot_matrix: [[{ plot_id: 1, treatment_combination: 'A1B1C1' }]],
    fieldbook: [{ plot_id: 1, rep: 1, factor_a_level: 'N0', factor_b_level: 'V1', factor_c_level: 'S1' }], layout_summary: {} });
});
function setup() {
  render(<FieldLayoutGenerator />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Experimental Design' }), { target: { value: 'factorial_rcbd' } });
}
describe('factorial layout form', () => {
  it('sends a third factor and preserves generated labels after form edits', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Number of factors'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Layout' }));
    await screen.findByRole('button', { name: 'Download Field Book (Excel)' });
    expect(mocks.request.mock.calls[0][1].jsonBody.factors).toEqual({ Nitrogen: ['N0', 'N1', 'N2'], Variety: ['V1', 'V2', 'V3'], Spacing: ['S1', 'S2'] });
    expect(screen.getByLabelText('Factor combination key')).toHaveTextContent('C — Spacing: C1 = S1; C2 = S2');
    fireEvent.change(screen.getByLabelText('Factor C name'), { target: { value: 'Changed after generation' } });
    fireEvent.change(screen.getByLabelText('Number of factors'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Download Field Book (Excel)' }));
    expect(mocks.download.mock.calls[0][1]).toMatchObject({ factorAName: 'Nitrogen', factorBName: 'Variety', factorCName: 'Spacing' });
  });
  it('omits the third factor by default', async () => {
    setup();
    expect(screen.queryByLabelText('Factor C levels')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Layout' }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
    expect(Object.keys(mocks.request.mock.calls[0][1].jsonBody.factors)).toEqual(['Nitrogen', 'Variety']);
  });
  it('rejects duplicate names and repeated levels before requesting randomisation', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Factor B name'), { target: { value: ' nitrogen ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Layout' }));
    expect(screen.getByText('Factor names must be distinct.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Factor B name'), { target: { value: 'Variety' } });
    fireEvent.change(screen.getByLabelText('Factor A levels'), { target: { value: 'N0, N0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Layout' }));
    expect(screen.getByText('Nitrogen has duplicate levels.')).toBeInTheDocument();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
