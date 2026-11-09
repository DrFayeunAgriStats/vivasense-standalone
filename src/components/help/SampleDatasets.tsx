import { useState } from "react";
import { Button } from "@/components/ui/button";

type Row = (string | number)[];
const blocks = ["B1", "B2", "B3", "B4"];
const genotypes = ["G1", "G2", "G3", "G4"];
const noise = [3, -2, 1, -4, 2, 4, -1, 0, -3, 1, 4, -2, 0, -4, 2, 3];
const trial = blocks.flatMap((block, b) => genotypes.map((g, i) => [
  block, g, (45 + 5 * i + 2 * b + noise[b * 4 + i]) / 10,
  72 + 4 * i + 3 * b - noise[(b * 4 + i + 5) % 16],
  19 + i + b + noise[(b * 4 + i + 9) % 16],
]));
const factorial = blocks.flatMap((block, b) => [0, 1].flatMap(a => [0, 1, 2].map(v => [
  block, `N${a * 60}`, `V${v + 1}`, (46 + 4 * a + 3 * v + 5 * a * v + b + noise[(b * 6 + a * 3 + v) % 16]) / 10,
])));
const split = blocks.flatMap((block, b) => [0, 1, 2].flatMap(a => genotypes.map((_, v) => [
  block, `N${a * 60}`, `V${v + 1}`, (45 + 5 * a + 3 * v + 3 * a * v + b + noise[b * 4 + a] + noise[(b * 7 + a * 4 + v) % 16]) / 10,
])));
// Workshop fixtures are deterministic, balanced and independently testable.
// All environment values are derived afresh; no response trait is cloned across
// locations as happened in the original multi-environment example.
const environments = ["Akure", "Ibadan", "Ikenne"];
const metTrial: Row[] = environments.flatMap((env, e) =>
  trial.map(([b, g, y, h, l], i) => {
    const genotypeIndex = genotypes.indexOf(String(g));
    return [
      env, b, g,
      Math.round((Number(y) + 0.4 * e + noise[(i + e * 3) % 16] / 10 + (genotypeIndex - e) * 0.06) * 100) / 100,
      Math.round((Number(h) + (e - 1) * 2.4 + noise[(i + e * 5 + 2) % 16] * 0.7 + 0.3 * genotypeIndex * e) * 10) / 10,
      Math.round((Number(l) + e * 0.8 + noise[(i + e * 7 + 1) % 16] * 0.5 + 0.15 * genotypeIndex * e) * 10) / 10,
    ];
  }),
);

// The second MET fixture explicitly demonstrates crossover G×E: the leading
// genotype changes Akure → Ibadan → Ikenne. All 45 cells are unique for
// Environment × Block × Genotype. Values are rounded to three decimals.
const crossoverMeans = [
  [6.2, 5.5, 4.8, 5.1, 4.3],
  [4.9, 6.9, 5.0, 4.7, 4.0],
  [4.6, 4.8, 5.7, 4.9, 4.2],
];
const crossoverTrial: Row[] = environments.flatMap((env, e) =>
  [0, 1, 2].flatMap((b) => [0, 1, 2, 3, 4].map((g) => {
    const deviation = [-0.12, 0.03, 0.09][b] + noise[(e * 5 + b * 3 + g) % 16] * 0.012;
    return [env, `B${b + 1}`, `G${g + 1}`,
      Math.round((crossoverMeans[e][g] + deviation) * 1000) / 1000];
  })),
);

export const sampleFixtures: { id: string; title: string; unit: string; columns: string[]; rows: Row[] }[] = [
  { id: "crd", title: "CRD", unit: "One independently randomised experimental unit per row.", columns: ["Treatment", "Yield"], rows: trial.map(([, g, y]) => [g, y]) },
  { id: "rcbd", title: "RCBD / breeding trait data", unit: "One genotype plot per block per row. Map Genotype as treatment for ANOVA, or as genotype for breeding.", columns: ["Block", "Genotype", "Yield", "Height", "LeafCount"], rows: trial },
  { id: "factorial-crd", title: "Factorial CRD", unit: "One experimental unit per row. Map Nitrogen and Variety as the two treatment factors.", columns: ["Nitrogen", "Variety", "Yield"], rows: factorial.map(([, n, v, y]) => [n, v, y]) },
  { id: "factorial-rcbd", title: "Factorial RCBD", unit: "One treatment-combination plot per block per row.", columns: ["Block", "Nitrogen", "Variety", "Yield"], rows: factorial },
  { id: "split-plot-rcbd", title: "Split-Plot RCBD", unit: "One subplot per row. Map Nitrogen to whole plot, Variety to subplot, and Block to replication.", columns: ["Block", "Nitrogen", "Variety", "Yield"], rows: split },
  { id: "correlation", title: "General Correlation", unit: "One independent plant per row. Select numeric traits, leaving PlantID out of the analysis.", columns: ["PlantID", "Height", "LeafCount", "Yield"], rows: trial.map(([, , y, h, l], i) => [`P${i + 1}`, h, l, y]) },
  { id: "met", title: "Multi-environment trials (routine)", unit: "Three locations × four blocks × four genotypes. All three response traits vary by location. G×E is not significant in this teaching example.", columns: ["Environment", "Block", "Genotype", "Yield", "Height", "LeafCount"], rows: metTrial },
  { id: "met-crossover", title: "Multi-environment trials (crossover G×E)", unit: "Three locations × three blocks × five genotypes, with a different highest-yielding genotype at each location. A significant interaction must govern interpretation.", columns: ["Environment", "Block", "Genotype", "Yield"], rows: crossoverTrial },
  { id: "bioassay", title: "Crop Protection Bioassay", unit: "Two products × four categorical dose levels × four blocks. Map Treatment to Factor A, Dose to Factor B and Replicate to Block. MortalityPct is an illustrative percentage response; use appropriate distributional diagnostics.", columns: ["Treatment", "Dose", "Replicate", "MortalityPct"], rows: blocks.flatMap((block, b) => ["ProductA", "ProductB"].flatMap((product, a) => [0, 1, 2, 4].map((dose, i) => [product, `D${dose}`, block, 8 + 14 * i + 4 * a * i + noise[b * 4 + i]]))) },
];

export function SampleDatasets({ ids, onTry, disabled }: {
  ids?: string[];
  onTry?: (file: File, sampleId: string) => void;
  disabled?: boolean;
}) {
  const available = sampleFixtures.filter(sample => !ids || ids.includes(sample.id));
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const sample = available.find(item => item.id === selected) ?? available[0];
  if (!sample) return null;

  async function download() {
    setError("");
    try {
      const { utils, writeFile } = await import("xlsx");
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, utils.aoa_to_sheet([sample.columns, ...sample.rows]), "Sample data");
      writeFile(workbook, `vivasense-sample-${sample.id}.xlsx`);
    } catch {
      setError("Could not download the sample. Please try again.");
    }
  }

  function loadSample() {
    const csv = [sample.columns, ...sample.rows].map(row => row.join(",")).join("\n");
    onTry?.(new File([csv], `vivasense-sample-${sample.id}.csv`, { type: "text/csv" }), sample.id);
  }

  return (
    <div className="space-y-3 rounded-lg border p-4 text-sm">
      <label className="flex flex-col gap-2 font-semibold">
        Sample dataset
        <select className="w-full rounded-md border bg-background p-2 font-normal" value={sample.id} onChange={event => setSelected(event.target.value)}>
          {available.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>
      <p className="text-muted-foreground">Synthetic example · {sample.unit}</p>
      <p className="break-words">Columns: {sample.columns.join(", ")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void download()}>Download sample Excel</Button>
        {onTry && <Button type="button" disabled={disabled} onClick={loadSample}>Try this sample</Button>}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
