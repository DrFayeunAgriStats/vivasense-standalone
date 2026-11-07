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
  RESULTS_FULL_CAUTIONS_POINTER,
  RESULTS_MULTIPLICITY_SHORT,
  RESULTS_PAIRWISE_SHORT,
  RESULTS_SCOPE_SHORT,
  RESULTS_SPEARMAN_SHORT,
  SCOPE_CAUTION,
  SPEARMAN_APPROXIMATION_NOTE,
} from "@/lib/generalCorrelationCautions";
import {
  DESIGN_COLUMN_WARNING,
  NOT_ESTIMABLE_MARK,
  buildInterpretation,
  coefSymbol,
  formatP,
  formatR,
  isDesignColumn,
  markerLegend,
  methodName,
  plural,
  sampleSizePhrase,
  significanceLabel,
  stateMark,
  type PresentationPair,
} from "@/lib/generalCorrelationPresentation";

interface ColumnInfo {
  name: string;
  isNumeric: boolean;
}

export interface GeneralPairResult extends PresentationPair {
  n: number;
}

export interface GeneralCorrelationResult extends Record<string, unknown> {
  trait_names: string[];
  method: GeneralCorrelationMethod;
  alpha: number;
  analysis_context: "general";
  pair_results: GeneralPairResult[];
  multiplicity: { n_hypotheses?: number; n_pairs_not_estimable?: number; n_pairs_inference_withheld?: number } | null;
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

function pairKey(a: string, b: string): string {
  return `${a}\u0000${b}`;
}

/** Lower-triangle matrix (diagonal omitted): coefficient + FDR marker, pairwise n beneath. */
export function GeneralCorrelationMatrix({ result }: { result: GeneralCorrelationResult }) {
  const traits = result.trait_names;
  const sym = coefSymbol(result.method);
  const lookup = new Map<string, GeneralPairResult>();
  for (const p of result.pair_results) {
    lookup.set(pairKey(p.trait_1, p.trait_2), p);
    lookup.set(pairKey(p.trait_2, p.trait_1), p);
  }
  return (
    <figure className="space-y-2" data-testid="general-matrix">
      <figcaption className="text-sm">
        <span className="font-semibold">Correlation matrix.</span> {methodName(result.method)} correlation
        coefficients ({sym}), lower triangle, diagonal omitted. Each cell shows {sym} and the number of
        pairwise-complete observations ({sampleSizePhrase(result.pair_results)}).
      </figcaption>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="border-collapse text-sm" aria-label={`Lower-triangle ${methodName(result.method)} correlation matrix`}>
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="border-b border-border px-3 py-2 text-left font-medium">Variable</th>
              {traits.slice(0, -1).map((t, j) => (
                <th key={t} scope="col" className="border-b border-border px-3 py-2 text-center font-medium" title={t}>
                  {j + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {traits.map((ti, i) => (
              <tr key={ti}>
                <th scope="row" className="min-w-[8rem] max-w-[14rem] break-words border-b border-border px-3 py-2 text-left align-top font-normal">
                  {i + 1}. {ti}
                </th>
                {traits.slice(0, -1).map((tj, j) => {
                  if (j >= i) return <td key={tj} className="border-b border-border px-3 py-2" />;
                  const p = lookup.get(pairKey(ti, tj));
                  const estimable = Boolean(p && p.estimable && p.r != null);
                  return (
                    <td key={tj} className="whitespace-nowrap border-b border-border px-3 py-1.5 text-center tabular-nums"
                      data-testid={`general-matrix-cell-${i}-${j}`}>
                      <span className="block">{estimable && p ? `${formatR(p.r)}${stateMark(p)}` : NOT_ESTIMABLE_MARK}</span>
                      <span className="block text-xs text-muted-foreground">{p?.n != null ? `n = ${p.n}` : ""}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground" data-testid="general-matrix-legend">
        {markerLegend(result.pair_results, result.alpha, result.multiplicity?.n_hypotheses)}
      </p>
    </figure>
  );
}

export function GeneralInterpretation({ result }: { result: GeneralCorrelationResult }) {
  const interp = buildInterpretation(result.trait_names, result.method, result.alpha, result.pair_results, result.multiplicity);
  return (
    <section className="space-y-2 text-sm" aria-label="Interpretation" data-testid="general-interpretation">
      <h3 className="font-semibold">Interpretation</h3>
      <p data-testid="general-interpretation-summary">{interp.summary}</p>
      <ul className="list-disc space-y-1.5 pl-5" data-testid="general-interpretation-pairs">
        {interp.items.map((item) => (
          <li key={item.label} data-state={item.state}>
            <span className="font-medium">{item.label}:</span> {item.text}
          </li>
        ))}
      </ul>
      <p>{interp.closing}</p>
    </section>
  );
}

export function GeneralCorrelationResults({ result }: { result: GeneralCorrelationResult }) {
  const sym = coefSymbol(result.method);
  const m = result.multiplicity?.n_hypotheses;
  const withheld = result.multiplicity?.n_pairs_inference_withheld ?? 0;
  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div>
        <h2 className="text-lg font-semibold">General Correlation Results</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {methodName(result.method)} correlations using pairwise-complete observations. Coefficients describe
          association, not causation.
        </p>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="general-inference-basis">
          Significance level α = {result.alpha}.{" "}
          {m != null
            ? `Benjamini–Hochberg FDR across ${plural(m, "inferentially eligible variable pair")}`
            : "Benjamini–Hochberg FDR across the estimable variable pairs"}
          {withheld ? ` (${plural(withheld, "pair")} with inference withheld)` : ""}; significance is judged on the
          adjusted p-value.
        </p>
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground" data-testid="general-results-notes">
        <p className="font-medium text-foreground">How to read these results</p>
        <p data-testid="general-results-scope">{RESULTS_SCOPE_SHORT}</p>
        {result.method === "spearman" && <p data-testid="general-results-spearman">{RESULTS_SPEARMAN_SHORT}</p>}
        <p data-testid="general-results-multiplicity">{RESULTS_MULTIPLICITY_SHORT}</p>
        <p data-testid="general-results-pairwise">{RESULTS_PAIRWISE_SHORT}</p>
        <p>{RESULTS_FULL_CAUTIONS_POINTER}</p>
      </div>
      <GeneralCorrelationMatrix result={result} />
      <figure className="space-y-2">
        <figcaption className="text-sm">
          <span className="font-semibold">Pairwise results.</span> {sym}, pairwise n, raw and FDR-adjusted p-values
          (four decimals; values below 0.0001 shown as &lt; 0.0001).
        </figcaption>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full border-collapse text-sm" data-testid="general-pair-table">
            <thead className="bg-muted/50">
              <tr>
                {["Variable 1", "Variable 2", sym, "n", "raw p", "FDR-adjusted p", `Significance (adjusted, α = ${result.alpha})`].map((h, i) => (
                  <th key={h} scope="col" className={`border-b border-border px-3 py-2 font-medium ${i >= 2 && i <= 5 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.pair_results.map((p) => (
                <tr key={`${p.trait_1}|${p.trait_2}`}>
                  <td className="min-w-[7rem] max-w-[12rem] break-words border-b border-border px-3 py-2 align-top">{p.trait_1}</td>
                  <td className="min-w-[7rem] max-w-[12rem] break-words border-b border-border px-3 py-2 align-top">{p.trait_2}</td>
                  <td className="border-b border-border px-3 py-2 text-right tabular-nums">{p.estimable ? formatR(p.r) : NOT_ESTIMABLE_MARK}</td>
                  <td className="border-b border-border px-3 py-2 text-right tabular-nums">{p.n}</td>
                  <td className="whitespace-nowrap border-b border-border px-3 py-2 text-right tabular-nums">{p.estimable ? formatP(p.p_raw) : NOT_ESTIMABLE_MARK}</td>
                  <td className="whitespace-nowrap border-b border-border px-3 py-2 text-right tabular-nums">{p.estimable ? formatP(p.p_adjusted) : NOT_ESTIMABLE_MARK}</td>
                  <td className="whitespace-nowrap border-b border-border px-3 py-2">{significanceLabel(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
      <p className="text-xs text-muted-foreground">
        Dataset rows available to this analysis: {result.phenotypic?.n_observations}. The n shown for each pair is the
        number of observations actually used for that coefficient. No genotype means, genetic variance components or
        genetic correlations are computed here.
      </p>
      <GeneralInterpretation result={result} />
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
  const [showDesignColumns, setShowDesignColumns] = useState(false);

  // Headers that occur more than once cannot be bound to one column; the backend refuses them too.
  const duplicateHeaders = useMemo(() => {
    const seen = new Map<string, number>();
    for (const c of columns) seen.set(c.name, (seen.get(c.name) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([name]) => name);
  }, [columns]);
  const usable = useMemo(
    () => columns.filter((c) => c.isNumeric && !duplicateHeaders.includes(c.name)),
    [columns, duplicateHeaders],
  );
  const designColumns = useMemo(() => usable.filter((c) => isDesignColumn(c.name)), [usable]);
  const numericColumns = useMemo(
    () => usable.filter((c) => showDesignColumns || !isDesignColumn(c.name)),
    [usable, showDesignColumns],
  );
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
    setShowDesignColumns(false);
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

          {(numericColumns.length > 0 || designColumns.length > 0) && (
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
                    <label key={c.name} className="flex min-w-0 items-start gap-2 break-words text-sm">
                      <input type="checkbox" className="mt-1 shrink-0" aria-label={`Variable ${c.name}`} checked={traits.includes(c.name)}
                        onChange={() => { toggleTrait(c.name); resetResult(); }} />
                      {c.name}
                      {isDesignColumn(c.name) && <span className="text-xs text-amber-800">(design column)</span>}
                    </label>
                  ))}
                </div>
                {duplicateHeaders.length > 0 && (
                  <p role="note" className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950"
                    data-testid="general-duplicate-headers">
                    These headers occur more than once, so their columns cannot be told apart and are not offered:{" "}
                    {duplicateHeaders.join(", ")}. Give each column a distinct header to analyse it.
                  </p>
                )}
                {designColumns.length > 0 && (
                  <div className="mt-3 space-y-2 text-sm" data-testid="general-design-columns">
                    <label className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" aria-label="Show design columns" checked={showDesignColumns}
                        onChange={(e) => {
                          const show = e.target.checked;
                          setShowDesignColumns(show);
                          if (!show) setTraits((cur) => cur.filter((t) => !isDesignColumn(t)));
                          resetResult();
                        }} />
                      <span>
                        Show design columns ({designColumns.map((c) => c.name).join(", ")}). They are hidden by default.
                      </span>
                    </label>
                    {showDesignColumns && (
                      <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950"
                        data-testid="general-design-warning">
                        {DESIGN_COLUMN_WARNING}
                      </p>
                    )}
                  </div>
                )}
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
