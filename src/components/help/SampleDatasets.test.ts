import { describe, expect, it } from "vitest";
import { sampleFixtures } from "./SampleDatasets";

function fixture(id: string) {
  const item = sampleFixtures.find(x => x.id === id);
  if (!item) throw new Error("missing teaching sample: " + id);
  return item;
}
function records(id: string) {
  const item = fixture(id);
  return item.rows.map(row => Object.fromEntries(item.columns.map((col, i) => [col, row[i]])));
}

describe("workshop example datasets", () => {
  for (const id of ["met", "met-crossover"]) {
    it(`${id} has complete RCBD within every environment and no duplicate plots`, () => {
      const rows = records(id);
      const expectedPerEnvironment = id === "met" ? 16 : 15;
      const envs = new Set(rows.map(r => r.Environment));
      expect(envs.size).toBe(3);
      expect(rows.length).toBe(expectedPerEnvironment * 3);
      const keys = rows.map(r => [r.Environment, r.Block, r.Genotype].join("|"));
      expect(new Set(keys).size).toBe(rows.length);
      const byEnvironment = [...envs].map(e => rows.filter(r => r.Environment === e));
      for (const rowsWithinEnvironment of byEnvironment) {
        const genotypes = new Set(rowsWithinEnvironment.map(r => r.Genotype));
        const blocks = new Set(rowsWithinEnvironment.map(r => r.Block));
        expect(rowsWithinEnvironment.length).toBe(genotypes.size * blocks.size);
        for (const block of blocks) {
          expect(rowsWithinEnvironment.filter(r => r.Block === block).length).toBe(genotypes.size);
        }
      }
    });
  }

  it("routine MET varies all response traits by environment and exports rounded numbers", () => {
    const rows = records("met");
    for (const trait of ["Yield", "Height", "LeafCount"]) {
      const values = ["Akure", "Ibadan", "Ikenne"].map(environment =>
        rows.find(r => r.Environment === environment && r.Block === "B1" && r.Genotype === "G1")?.[trait]);
      expect(new Set(values).size).toBe(3);
      expect(rows.every(r => typeof r[trait] === "number" && Number.isFinite(r[trait]))).toBe(true);
    }
    expect(rows.every(r => Math.abs(Number(r.Yield) * 100 - Math.round(Number(r.Yield) * 100)) < 1e-9)).toBe(true);
  });

  it("crossover MET has a distinct highest observed genotype in each environment", () => {
    const rows = records("met-crossover");
    const winners = ["Akure", "Ibadan", "Ikenne"].map(env => {
      const inside = rows.filter(r => r.Environment === env);
      const genotypes = [...new Set(inside.map(r => r.Genotype))];
      const means = genotypes.map(g => ({
        genotype: String(g),
        mean: inside.filter(r => r.Genotype === g)
          .reduce((sum, r) => sum + Number(r.Yield), 0) / 3,
      }));
      return means.sort((a, b) => b.mean - a.mean)[0].genotype;
    });
    expect(winners).toEqual(["G1", "G2", "G3"]);
    expect(rows.every(r => Math.abs(Number(r.Yield) * 1000 - Math.round(Number(r.Yield) * 1000)) < 1e-9)).toBe(true);
  });

  it("bioassay uses selectable categorical dose levels, not numeric response candidates", () => {
    const item = fixture("bioassay");
    const rows = records("bioassay");
    expect(rows.length).toBe(32);
    expect([...new Set(rows.map(r => r.Dose))].sort()).toEqual(["D0", "D1", "D2", "D4"]);
    expect(rows.every(r => typeof r.Dose === "string" && typeof r.MortalityPct === "number")).toBe(true);
    expect(item.columns).toEqual(["Treatment", "Dose", "Replicate", "MortalityPct"]);
  });
});
