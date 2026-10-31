import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildFieldBookAoa } from './fieldBookExport';

describe('factorial fieldbook', () => {
  it('round-trips all three named factors and plot identities through Excel', () => {
    const rows = Array.from({ length: 3 }, (_, rep) =>
      ['V1', 'V2', 'V3'].flatMap((a, i) => ['N0', 'N1'].flatMap((b, j) => ['S1', 'S2'].map((c, k) => ({
        plot_id: rep * 12 + i * 4 + j * 2 + k + 1, rep: rep + 1, block: rep + 1,
        treatment_combination: `A${i + 1}B${j + 1}C${k + 1}`,
        factor_a_level: a, factor_b_level: b, factor_c_level: c,
      }))))).flat();
    const aoa = buildFieldBookAoa(rows, { design: 'factorial_rcbd', factorAName: 'Variety', factorBName: 'Nitrogen', factorCName: 'Spacing', traitColumns: ['Yield'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Field Book');
    const restored = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(restored.Sheets['Field Book']);
    expect(data).toHaveLength(36);
    expect(new Set(data.map(r => r['Plot Number'])).size).toBe(36);
    for (let rep = 1; rep <= 3; rep++) {
      const block = data.filter(r => r.Replication === rep);
      expect(block).toHaveLength(12);
      expect(new Set(block.map(r => JSON.stringify([r.Variety, r.Nitrogen, r.Spacing]))).size).toBe(12);
    }
    expect(data[0]).toMatchObject({ Treatment: 'A1B1C1', Variety: 'V1', Nitrogen: 'N0', Spacing: 'S1', Yield: '' });
  });

  it('preserves the two-factor and simple RCBD column sets', () => {
    const row = { plot_id: 1, rep: 1, treatment_combination: 'A1B1', factor_a_level: 'N0', factor_b_level: 'V1' };
    const two = buildFieldBookAoa([row], { design: 'factorial_rcbd', factorAName: 'Nitrogen', factorBName: 'Variety', traitColumns: [] });
    expect(two[0]).toEqual(['Plot Number', 'Replication', 'Block', 'Row', 'Column', 'Treatment', 'Genotype', 'Nitrogen', 'Variety', 'Remarks']);
    expect(two[1].slice(5, 9)).toEqual(['A1B1', 'A1B1', 'N0', 'V1']);
    expect(buildFieldBookAoa([{ plot_id: 1, treatment: 'T1' }], { design: 'rcbd', traitColumns: ['Yield'] })[0]).not.toContain('Factor C');
  });
});
