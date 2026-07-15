/**
 * Digital Field Book export (Sprint 4.3).
 *
 * Turns a Field Layout Generator response (its `fieldbook` rows) into a clean,
 * printable Excel workbook for field data collection. Design-aware: maps each
 * design's fieldbook shape (CRD/RCBD/factorial/split-plot/…) onto a consistent
 * column set, appends empty trait columns plus a Remarks column, and keeps the
 * header row first so the completed sheet re-uploads into VivaSense unmodified.
 *
 * Reuses the existing `xlsx` (SheetJS) dependency — no new infrastructure.
 */
import * as XLSX from "xlsx";

/** One row from a field-layout response `fieldbook` array. */
export type FieldbookRow = Record<string, unknown>;

export interface FieldBookOptions {
  /** Design id, e.g. "rcbd", "crd", "factorial_rcbd", "split_plot". */
  design: string;
  /** Custom factor-A / factor-B names for factorial designs (fallbacks used otherwise). */
  factorAName?: string;
  factorBName?: string;
  /** Empty trait columns to include for data entry (headers only, no values). */
  traitColumns: string[];
}

/** Fixed leading columns present for every design (blank where a design lacks the field). */
const STANDARD_HEADERS = [
  "Plot Number", "Replication", "Block", "Row", "Column", "Treatment", "Genotype",
] as const;

function str(v: unknown): string | number {
  if (v == null) return "";
  if (typeof v === "number") return v;
  return String(v);
}

/** Human treatment label across designs (single treatment, factorial combo, or nested main/sub). */
function treatmentLabel(row: FieldbookRow): string {
  if (row.treatment != null) return String(row.treatment);
  if (row.treatment_combination != null) return String(row.treatment_combination);
  const parts = [row.main_treatment, row.sub_treatment, row.sub_sub_treatment]
    .filter((x) => x != null)
    .map(String);
  return parts.join(" / ");
}

/** Extra factor columns for the design (empty for simple designs). */
function factorColumns(opts: FieldBookOptions): { header: string; key: (row: FieldbookRow) => unknown }[] {
  const d = opts.design;
  if (d === "factorial_rcbd" || d === "factorial") {
    return [
      { header: opts.factorAName?.trim() || "Factor A", key: (r) => r.factor_a_level },
      { header: opts.factorBName?.trim() || "Factor B", key: (r) => r.factor_b_level },
    ];
  }
  if (d === "split_plot") {
    return [
      { header: "Main Plot Factor", key: (r) => r.main_treatment },
      { header: "Sub Plot Factor", key: (r) => r.sub_treatment },
    ];
  }
  if (d === "split_split") {
    return [
      { header: "Main Plot Factor", key: (r) => r.main_treatment },
      { header: "Sub Plot Factor", key: (r) => r.sub_treatment },
      { header: "Sub-Sub Plot Factor", key: (r) => r.sub_sub_treatment },
    ];
  }
  return [];
}

/**
 * Build the field book as an array-of-arrays (row 0 = headers). Pure and
 * side-effect free so it can be unit-tested and reused.
 */
export function buildFieldBookAoa(
  fieldbook: FieldbookRow[],
  opts: FieldBookOptions,
): (string | number)[][] {
  const factors = factorColumns(opts);
  const traits = opts.traitColumns.map((t) => t.trim()).filter(Boolean);

  const headers: string[] = [
    ...STANDARD_HEADERS,
    ...factors.map((f) => f.header),
    ...traits,
    "Remarks",
  ];

  const rows = fieldbook.map((row) => {
    const label = treatmentLabel(row);
    const standard: (string | number)[] = [
      str(row.plot_id),
      str(row.rep),
      str(row.block),
      str(row.row),
      str(row.column),
      label,
      label, // Genotype: the entry identifier (equals treatment for genotype trials)
    ];
    const factorCells = factors.map((f) => str(f.key(row)));
    const traitCells = traits.map(() => ""); // empty — filled in the field
    return [...standard, ...factorCells, ...traitCells, ""]; // trailing Remarks
  });

  return [headers, ...rows];
}

/** Column widths for a clean, printable sheet. */
function columnWidths(headers: string[]): { wch: number }[] {
  return headers.map((h) => {
    if (h === "Treatment" || h === "Genotype" || h.startsWith("Factor") || h.includes("Plot Factor")) return { wch: 16 };
    if (h === "Remarks") return { wch: 28 };
    if (["Plot Number", "Replication", "Block", "Row", "Column"].includes(h)) return { wch: 12 };
    return { wch: 14 }; // trait columns
  });
}

/**
 * Build and download the Excel field book. The single "Field Book" sheet has the
 * column headers in row 1 (nothing above), so once trait values are entered the
 * file uploads to VivaSense without any structural change.
 */
export function downloadFieldBook(
  fieldbook: FieldbookRow[],
  opts: FieldBookOptions,
  filename: string,
): void {
  const aoa = buildFieldBookAoa(fieldbook, opts);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columnWidths(aoa[0] as string[]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Field Book");
  XLSX.writeFile(wb, filename);
}
