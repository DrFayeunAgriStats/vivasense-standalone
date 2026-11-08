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
const samples: { id: string; title: string; unit: string; columns: string[]; rows: Row[] }[] = [
  { id: "crd", title: "CRD", unit: "One independently randomised experimental unit per row.", columns: ["Treatment", "Yield"], rows: trial.map(([, g, y]) => [g, y]) },
  { id: "rcbd", title: "RCBD / breeding trait data", unit: "One genotype plot per block per row. Map Genotype as treatment for ANOVA, or as genotype for breeding.", columns: ["Block", "Genotype", "Yield", "Height", "LeafCount"], rows: trial },
  { id: "factorial-crd", title: "Factorial CRD", unit: "One experimental unit per row. Map Nitrogen and Variety as the two treatment factors.", columns: ["Nitrogen", "Variety", "Yield"], rows: factorial.map(([, n, v, y]) => [n, v, y]) },
  { id: "factorial-rcbd", title: "Factorial RCBD", unit: "One treatment-combination plot per block per row.", columns: ["Block", "Nitrogen", "Variety", "Yield"], rows: factorial },
  { id: "split-plot-rcbd", title: "Split-Plot RCBD", unit: "One subplot per row. Map Nitrogen to whole plot, Variety to subplot, and Block to replication.", columns: ["Block", "Nitrogen", "Variety", "Yield"], rows: split },
  { id: "correlation", title: "General Correlation", unit: "One independent plant per row. Select numeric traits, leaving PlantID out of the analysis.", columns: ["PlantID", "Height", "LeafCount", "Yield"], rows: trial.map(([, , y, h, l], i) => [`P${i + 1}`, h, l, y]) },
  { id: "met", title: "Multi-environment trials", unit: "One genotype plot per block within an environment per row.", columns: ["Environment", "Block", "Genotype", "Yield", "Height", "LeafCount"], rows: ["Akure", "Ibadan", "Ikenne"].flatMap((env, e) => trial.map(([b, g, y, h, l], i) => [env, b, g, Number(y) + (e * 4 + noise[(i + e * 3) % 16]) / 10, h, l])) },
  { id: "bioassay", title: "Crop Protection Bioassay", unit: "One experimental unit per row. Map Treatment, Dose, and Replicate as design columns and MortalityPct as the response.", columns: ["Treatment", "Dose", "Replicate", "MortalityPct"], rows: blocks.flatMap((block, b) => ["ProductA", "ProductB"].flatMap((product, a) => [0, 1, 2, 4].map((dose, i) => [product, dose, block, 8 + 14 * i + 4 * a * i + noise[b * 4 + i]]))) },
];

export function SampleDatasets({ ids, onTry, disabled }: {
  ids?: string[];
  onTry?: (file: File) => void;
  disabled?: boolean;
}) {
  const available = samples.filter(sample => !ids || ids.includes(sample.id));
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
    onTry?.(new File([csv], `vivasense-sample-${sample.id}.csv`, { type: "text/csv" }));
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
