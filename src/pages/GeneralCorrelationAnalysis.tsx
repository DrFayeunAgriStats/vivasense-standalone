/**
 * REL-UI-01 Phase A (Option B) — General correlation (observed variables only).
 *
 * Uses POST /genetics/correlation/general and the verified Word report at
 * POST /export/correlation-word/general. No genotype, replication, design or
 * genetic control exists on this page; genetic analyses stay on the existing,
 * unchanged pages.
 */
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { AlertCircle, ArrowLeft, Download, FileSpreadsheet, Loader2, ShieldAlert, UploadCloud, X } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vivaSenseRequest } from "@/services/vivasenseApiClient";
import {
  GENERAL_CORRELATION_ENDPOINT,
  GENERAL_SUPPORTED_ALPHAS,
  buildGeneralCorrelationRequest,
  type GeneralCorrelationAlpha,
  type GeneralCorrelationMethod,
} from "@/lib/generalCorrelationContract";
import { downloadGeneralWord, hasIntegritySeal } from "@/lib/generalWordExport";
import {
  MULTIPLE_TESTING_NOTE,
  PAIRWISE_MISSING_NOTE,
  SCOPE_CAUTION,
  SPEARMAN_APPROXIMATION_NOTE,
} from "@/lib/generalCorrelationCautions";

interface ColumnInfo {
  name: string;
  isNumeric: boolean;
}

export interface GeneralPairResult {
  trait_1: string;
  trait_2: string;
  n: number;
  estimable: boolean;
  r: number | null;
  p_raw: number | null;
  p_adjusted: number | null;
  significant_adjusted: boolean | null;
}

export interface GeneralCorrelationResult extends Record<string, unknown> {
  trait_names: string[];
  method: GeneralCorrelationMethod;
  alpha: number;
  analysis_context: "general";
  pair_results: GeneralPairResult[];
  multiplicity: { n_hypotheses?: number; n_pairs_not_estimable?: number } | null;
  phenotypic: { n_observations: number };
  warnings?: string[];
  interpretation?: string;
}

const NA_TOKENS = new Set(["", "na", "n/a", "nan", "null", "none", "-", "--"]);

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || NA_TOKENS.has(String(value).trim().toLowerCase());
}

function isNumericLike(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  const text = String(value ?? "").trim().replace(/,/g, "");
  return text !== "" && Number.isFinite(Number(text));
}

function fileTypeFor(file: File): "csv" | "xlsx" | "xls" {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".xls")) return "xls";
  return "xlsx";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the dataset."));
    reader.readAsDataURL(file);
  });
}

export function formatCoefficient(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(3);
}

export function formatP(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 0.001) return "<0.001";
  return value.toFixed(4);
}

export function GeneralCorrelationResults({ result }: { result: GeneralCorrelationResult }) {
  const sym = result.method === "spearman" ? "ρ" : "r";
  const m = result.multiplicity?.n_hypotheses;
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div>
        <h2 className="text-lg font-semibold">General Correlation Results</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.method === "spearman" ? "Spearman rank" : "Pearson"} correlations using pairwise-complete
          observations. Coefficients describe association, not causation.
        </p>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="general-inference-basis">
          Significance level α = {result.alpha}. Benjamini–Hochberg FDR across {m ?? "the estimable"} variable
          pair(s); significance is judged on the adjusted p-value.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full border-collapse text-sm" data-testid="general-pair-table">
          <thead className="bg-muted/50">
            <tr>
              {["Variable 1", "Variable 2", sym, "n", "raw p", "FDR-adjusted p", `Significant (adjusted, α = ${result.alpha})`].map((h) => (
                <th key={h} className="border-b border-border px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.pair_results.map((p) => (
              <tr key={`${p.trait_1}|${p.trait_2}`}>
                <td className="border-b border-border px-3 py-2">{p.trait_1}</td>
                <td className="border-b border-border px-3 py-2">{p.trait_2}</td>
                <td className="border-b border-border px-3 py-2 text-right">{p.estimable ? formatCoefficient(p.r) : "—"}</td>
                <td className="border-b border-border px-3 py-2 text-right">{p.n}</td>
                <td className="border-b border-border px-3 py-2 text-right">{p.estimable ? formatP(p.p_raw) : "—"}</td>
                <td className="border-b border-border px-3 py-2 text-right">{p.estimable ? formatP(p.p_adjusted) : "—"}</td>
                <td className="border-b border-border px-3 py-2">
                  {!p.estimable ? "not estimated" : p.significant_adjusted === null ? "not assessed" : p.significant_adjusted ? "yes" : "no"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Dataset rows available to this analysis: {result.phenotypic?.n_observations}. The n shown for each pair is the
        number of observations actually used for that coefficient. No genotype means, genetic variance components or
        genetic correlations are computed here.
      </p>
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground" data-testid="general-results-notes">
        <p className="font-medium text-foreground">How to read these results</p>
        <p data-testid="general-results-scope">{SCOPE_CAUTION}</p>
        {result.method === "spearman" && <p data-testid="general-results-spearman">{SPEARMAN_APPROXIMATION_NOTE}</p>}
        <p data-testid="general-results-multiplicity">{MULTIPLE_TESTING_NOTE}</p>
        <p data-testid="general-results-pairwise">{PAIRWISE_MISSING_NOTE}</p>
      </div>
      {result.interpretation && (
        <p className="text-sm" data-testid="general-interpretation">{result.interpretation}</p>
      )}
    </div>
  );
}

export default function GeneralCorrelationAnalysis() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [traits, setTraits] = useState<string[]>([]);
  const [method, setMethod] = useState<GeneralCorrelationMethod>("pearson");
  const [alpha, setAlpha] = useState<GeneralCorrelationAlpha>(0.05);
  const [parseError, setParseError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GeneralCorrelationResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const numericColumns = useMemo(() => columns.filter((c) => c.isNumeric), [columns]);
  const warnings = useMemo(
    () => (result && Array.isArray(result.warnings) ? result.warnings.map(String).filter(Boolean) : []),
    [result],
  );
  const canRun = Boolean(file && traits.length >= 2 && !isLoading);

  const resetResult = () => {
    setResult(null);
    setError(null);
    setExportError(null);
  };

  const parseFile = async (nextFile: File) => {
    setParseError(null);
    setTraits([]);
    resetResult();
    try {
      const lower = nextFile.name.toLowerCase();
      let workbook: XLSX.WorkBook;
      if (lower.endsWith(".csv")) workbook = XLSX.read(await nextFile.text(), { type: "string" });
      else if (lower.endsWith(".xlsx") || lower.endsWith(".xls"))
        workbook = XLSX.read(await nextFile.arrayBuffer(), { type: "array" });
      else throw new Error("Upload a CSV or Excel (.xlsx/.xls) file.");
      const sheet = workbook.SheetNames[0];
      if (!sheet) throw new Error("The workbook contains no worksheet.");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, defval: "" });
      if (rows.length < 2) throw new Error("The file needs a header row and at least one data row.");
      const headers = (Array.isArray(rows[0]) ? rows[0] : []).map(
        (v, i) => String(v ?? "").trim() || `Column ${i + 1}`,
      );
      const dataRows = rows.slice(1);
      setColumns(
        headers.map((name, index) => {
          const values = dataRows
            .map((row) => (Array.isArray(row) ? row[index] : undefined))
            .filter((v) => !isMissing(v));
          return { name, isNumeric: values.length > 0 && values.every(isNumericLike) };
        }),
      );
    } catch (err) {
      setColumns([]);
      setParseError(err instanceof Error ? err.message : "Could not parse that dataset.");
    }
  };

  const toggleTrait = (name: string) =>
    setTraits((cur) => (cur.includes(name) ? cur.filter((t) => t !== name) : [...cur, name].slice(0, 15)));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !canRun) return;
    setIsLoading(true);
    resetResult();
    try {
      const request = buildGeneralCorrelationRequest({
        base64Content: await fileToBase64(file),
        fileType: fileTypeFor(file),
        traitColumns: traits,
        method,
        alpha,
      });
      const response = await vivaSenseRequest<GeneralCorrelationResult>(GENERAL_CORRELATION_ENDPOINT, {
        method: "POST",
        jsonBody: request,
        timeoutMs: 60000,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "General correlation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWordDownload = async () => {
    if (!result) return;
    setIsExporting(true);
    setExportError(null);
    try {
      await downloadGeneralWord(result);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "The Word report could not be generated.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:px-10">
        <Button type="button" variant="outline" size="sm" className="mb-5" onClick={() => navigate("/workspace")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Research Workspace
        </Button>
        <h1 className="text-2xl font-semibold">General Correlation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ordinary association among observed numeric variables (Pearson or Spearman). This page does not estimate
          genetic correlations; it does not use genotype, replication or design information.
        </p>

        <div role="note" aria-label="Scope of this analysis" data-testid="general-scope-caution"
          className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="mb-1 font-semibold">Before you run this analysis</p>
          <p>{SCOPE_CAUTION}</p>
        </div>

        <form className="mt-6 space-y-5 rounded-xl border border-border bg-card p-5" onSubmit={handleSubmit}>
          {!file ? (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm">
              <UploadCloud className="h-6 w-6" />
              <span>Upload a CSV or Excel file</span>
              <Input
                aria-label="Upload general correlation dataset"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="max-w-xs"
                onChange={async (e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (!f) return;
                  setFile(f);
                  await parseFile(f);
                }}
              />
            </label>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />{file.name}</span>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove dataset"
                onClick={() => { setFile(null); setColumns([]); setTraits([]); setParseError(null); resetResult(); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {parseError && <p className="text-sm text-red-700" role="alert">{parseError}</p>}

          {numericColumns.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Correlation method
                  <select aria-label="Correlation method" className="mt-1 w-full rounded-md border border-border bg-background p-2"
                    value={method} onChange={(e) => { setMethod(e.target.value as GeneralCorrelationMethod); resetResult(); }}>
                    <option value="pearson">Pearson</option>
                    <option value="spearman">Spearman (rank)</option>
                  </select>
                </label>
                <label className="text-sm">
                  Significance level
                  <select aria-label="Significance level" className="mt-1 w-full rounded-md border border-border bg-background p-2"
                    value={String(alpha)} onChange={(e) => { setAlpha(Number(e.target.value) as GeneralCorrelationAlpha); resetResult(); }}>
                    {GENERAL_SUPPORTED_ALPHAS.map((a) => <option key={a} value={String(a)}>{a === 0.1 ? "0.10" : a}</option>)}
                  </select>
                </label>
              </div>
              {method === "spearman" && (
                <p role="note" className="text-xs text-amber-900" data-testid="general-spearman-caution">
                  {SPEARMAN_APPROXIMATION_NOTE}
                </p>
              )}
              <fieldset>
                <legend className="text-sm font-medium">Variables (select at least two)</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {numericColumns.map((c) => (
                    <label key={c.name} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" aria-label={`Variable ${c.name}`} checked={traits.includes(c.name)}
                        onChange={() => { toggleTrait(c.name); resetResult(); }} />
                      {c.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button type="submit" disabled={!canRun}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Run General Correlation
              </Button>
            </>
          )}
        </form>

        {error && (
          <div className="mt-6 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">The analysis was not run</p>
              <p className="mt-1" data-testid="general-error-detail">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <section className="mt-6 space-y-4" aria-label="General correlation results">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm">
              <p className="text-muted-foreground">
                Quick analysis — not saved to a study. The Word report is generated only from this sealed result.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={handleWordDownload}
                disabled={isExporting || !hasIntegritySeal(result)} data-testid="general-word-download">
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download Word report
              </Button>
            </div>
            {!hasIntegritySeal(result) && (
              <p className="text-sm text-amber-800" data-testid="general-word-unavailable">
                A verified Word report is unavailable: this result carries no VivaSense integrity seal.
              </p>
            )}
            {exportError && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">The Word report was not generated</p>
                  <p className="mt-1" data-testid="general-word-error">{exportError}</p>
                </div>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
                <div className="mb-2 flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" />Warnings from the analysis engine</div>
                <ul className="list-disc space-y-1 pl-5">{warnings.map((w, i) => <li key={`${w}-${i}`}>{w}</li>)}</ul>
              </div>
            )}
            <GeneralCorrelationResults result={result} />
          </section>
        )}
      </div>
    </Layout>
  );
}
