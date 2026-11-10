import { describe, expect, it } from "vitest";

import { buildDescriptiveStats } from "./resultCounts";

function asMap(rows: { label: string; value: string }[]) {
  return Object.fromEntries(rows.map((row) => [row.label, row.value]));
}

describe("DESC-01 one-factor descriptive statistics", () => {
  it("renders the governed persisted descriptive contract", () => {
    const rows = buildDescriptiveStats({
      grand_mean: 15.5,
      n_genotypes: 4,
      n_reps: 3,
      descriptive_stats: {
        n: 12,
        grand_mean: 15.5,
        standard_deviation: 3.6055512755,
        standard_error: 1.040833,
        min: 10,
        max: 21,
        cv_percent: 23.261621,
      },
    } as any);
    const mapped = asMap(rows);

    expect(mapped.N).toBe("12");
    expect(mapped.Mean).toBe("15.5000");
    expect(mapped.SD).toBe("3.6056");
    expect(mapped.SE).toBe("1.0408");
    expect(mapped.Minimum).toBe("10.0000");
    expect(mapped.Maximum).toBe("21.0000");
    expect(mapped["Descriptive CV (%)"]).toBe("23.26");
    expect(mapped["Treatment Levels"]).toBe("4");
    expect(mapped.Replications).toBe("3");
  });

  it("reconstructs legacy durable results from persisted fitted observations", () => {
    const rows = buildDescriptiveStats({
      grand_mean: 14,
      n_genotypes: 3,
      n_reps: 1,
      observation_accounting: { effective_n: 3 },
      diagnostic_observations: [
        { observed: 10 },
        { observed: 14 },
        { observed: 18 },
      ],
    } as any);
    const mapped = asMap(rows);

    expect(mapped.N).toBe("3");
    expect(mapped.Mean).toBe("14.0000");
    expect(mapped.SD).toBe("4.0000");
    expect(mapped.SE).toBe("2.3094");
    expect(mapped.Minimum).toBe("10.0000");
    expect(mapped.Maximum).toBe("18.0000");
    expect(mapped["Descriptive CV (%)"]).toBe("28.57");
  });
});
