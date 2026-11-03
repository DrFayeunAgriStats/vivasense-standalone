import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  ArrowLeft,
  FileSpreadsheet,
  FlaskConical,
  Loader2,
  ShieldAlert,
  UploadCloud,
  X,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VivaSenseResultsDisplay from "@/components/vivasense/VivaSenseResultsDisplay";
import { vivaSenseRequest } from "@/services/vivasenseApiClient";
import { resolveEnvironmentMode } from "@/lib/environmentValidation";
import {
  buildRelationshipCorrelationRequest,
  type RelationshipAnalysisContext,
  type RelationshipCorrelationMethod,
  type RelationshipCorrelationMode,
} from "@/lib/relationshipCorrelationRequest";

interface ColumnInfo {
  name: string;
  isNumeric: boolean;
}

interface EnvironmentResolution {
  mode: RelationshipCorrelationMode;
  distinctCount: number;
  downgradeReason: string | null;
}

interface CorrelationStatsResult {
  n_observations: number;
  n_matrix?: Array<Array<number | null>> | null;
  r_matrix: Array<Array<number | null>>;
  p_matrix: Array<Array<number | null>>;
  p_adj_matrix: Array<Array<number | null>>;
}

interface RelationshipResult extends Record<string, unknown> {
  trait_names: string[];
  method: RelationshipCorrelationMethod;
  analysis_context?: RelationshipAnalysisContext;
  phenotypic: CorrelationStatsResult;
  warnings?: string[];
  interpretation?: string;
}

const NA_TOKENS = new Set(["", "na", "n/a", "nan", "null", "none", "-", "--"]);

type GeneticMaterialAnswer = "" | "yes" | "no";

function isNumericLike(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const cleaned = value.trim().replace(/,/g, "");
  if (!cleaned || NA_TOKENS.has(cleaned.toLowerCase())) return false;
  return /^[+-]?(\d+(\.\d+)?|\.\d+)(e[+-]?\d+)?$/i.test(cleaned);
}

function isMissing(value: unknown): boolean {
  if (value == null) return true;
  const text = String(value).trim();
  return !text || NA_TOKENS.has(text.toLowerCase());
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

function formatNumber(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  if (value === 0) return "0";
  if (Math.abs(value) < 0.001) return "<0.001";
  return value.toFixed(digits);
}

function GeneralCorrelationResults({ result }: { result: RelationshipResult }) {
  const traits = result.trait_names;
  const stats = result.phenotypic;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div>
        <h2 className="text-lg font-semibold">General Correlation Results</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.method === "spearman" ? "Spearman rank" : "Pearson"} correlations using pairwise-complete observations.
          Coefficients describe association, not causation.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="border-b border-border px-3 py-2 text-left font-medium">Variable</th>
              {traits.map((trait) => (
                <th key={trait} className="border-b border-border px-3 py-2 text-right font-medium">{trait}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {traits.map((rowTrait, i) => (
              <tr key={rowTrait}>
                <th className="border-b border-border px-3 py-2 text-left font-medium">{rowTrait}</th>
                {traits.map((colTrait, j) => {
                  const r = stats.r_matrix?.[i]?.[j] ?? null;
                  const n = stats.n_matrix?.[i]?.[j] ?? null;
                  const pAdj = stats.p_adj_matrix?.[i]?.[j] ?? null;
                  return (
                    <td key={colTrait} className="border-b border-border px-3 py-2 text-right align-top">
                      {r == null ? (
                        <span className="text-muted-foreground">N/A — undefined</span>
                      ) : (
                        <div>
                          <div className="font-medium">{formatNumber(r)}</div>
                          {i !== j && (
                            <div className="text-xs text-muted-foreground">
                              n={n ?? "N/A"}{pAdj == null ? "" : ` · FDR p=${formatNumber(pAdj, 4)}`}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Dataset rows available to this analysis: {stats.n_observations}. When missing values occur, the n shown for each pair is the number of observations actually used for that coefficient.
      </p>
    </div>
  );
}

export default function RelationshipAnalysis() {
  const navigate = useNavigate();
  const [analysisContext, setAnalysisContext] = useState<RelationshipAnalysisContext>("general");
  const [geneticMaterialAnswer, setGeneticMaterialAnswer] = useState<GeneticMaterialAnswer>("");
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [genotype, setGenotype] = useState("");
  const [rep, setRep] = useState("");
  const [environment, setEnvironment] = useState("");
  const [traits, setTraits] = useState<string[]>([]);
  const [method, setMethod] = useState<RelationshipCorrelationMethod>("pearson");
  const [parseError, setParseError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RelationshipResult | null>(null);
  const [environmentResolution, setEnvironmentResolution] = useState<EnvironmentResolution | null>(null);

  const numericColumns = useMemo(() => columns.filter((c) => c.isNumeric), [columns]);
  const availableTraits = useMemo(() => {
    if (analysisContext === "general") return numericColumns;
    return numericColumns.filter((c) => ![genotype, rep, environment].includes(c.name));
  }, [analysisContext, numericColumns, genotype, rep, environment]);

  const warnings = useMemo(() => {
    if (!result || !Array.isArray(result.warnings)) return [];
    return result.warnings.map((w) => String(w)).filter(Boolean);
  }, [result]);

  const canRun = Boolean(
    file &&
      traits.length >= 2 &&
      !isLoading &&
      (analysisContext === "general" ||
        (genotype && rep && geneticMaterialAnswer === "yes")),
  );

  const resetAnalysis = () => {
    setGenotype("");
    setRep("");
    setEnvironment("");
    setTraits([]);
    setMethod("pearson");
    setGeneticMaterialAnswer("");
    setEnvironmentResolution(null);
    setResult(null);
    setError(null);
  };

  const changeContext = (next: RelationshipAnalysisContext) => {
    if (next === analysisContext) return;
    setAnalysisContext(next);
    resetAnalysis();
  };

  const parseFile = async (nextFile: File) => {
    setParseError(null);
    resetAnalysis();
    try {
      const lower = nextFile.name.toLowerCase();
      let workbook: XLSX.WorkBook;
      if (lower.endsWith(".csv")) {
        workbook = XLSX.read(await nextFile.text(), { type: "string" });
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        workbook = XLSX.read(await nextFile.arrayBuffer(), { type: "array" });
      } else {
        throw new Error("Upload a CSV or Excel (.xlsx/.xls) file.");
      }

      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error("The workbook contains no worksheet.");
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], {
        header: 1,
        defval: "",
      });
      if (rows.length < 2) throw new Error("The file needs a header row and at least one data row.");

      const rawHeaders = Array.isArray(rows[0]) ? rows[0] : [];
      const headers = rawHeaders.map((value, index) => String(value ?? "").trim() || `Column ${index + 1}`);
      const dataRows = rows.slice(1);
      const info = headers.map((name, index) => {
        const values = dataRows
          .map((row) => (Array.isArray(row) ? row[index] : undefined))
          .filter((value) => !isMissing(value));
        return {
          name,
          isNumeric: values.length > 0 && values.every(isNumericLike),
        };
      });

      setColumns(info);
    } catch (err) {
      setColumns([]);
      setParseError(err instanceof Error ? err.message : "Could not parse that dataset.");
    }
  };

  const handleFileChange = async (nextFile: File | null) => {
    if (!nextFile) return;
    setFile(nextFile);
    await parseFile(nextFile);
  };

  const removeFile = () => {
    setFile(null);
    setColumns([]);
    setParseError(null);
    resetAnalysis();
  };

  const toggleTrait = (name: string) => {
    setTraits((current) =>
      current.includes(name) ? current.filter((t) => t !== name) : [...current, name].slice(0, 15),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !canRun) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setEnvironmentResolution(null);

    try {
      let resolution: EnvironmentResolution | null = null;
      if (analysisContext === "genetic") {
        const requestedMode: RelationshipCorrelationMode = environment ? "multi" : "single";
        resolution = await resolveEnvironmentMode(file, environment || null, requestedMode, []);
        setEnvironmentResolution(resolution);
      }

      const base64Content = await fileToBase64(file);
      const request = buildRelationshipCorrelationRequest({
        base64Content,
        fileType: fileTypeFor(file),
        analysisContext,
        geneticMaterialConfirmed: analysisContext === "genetic" && geneticMaterialAnswer === "yes",
        genotypeColumn: analysisContext === "genetic" ? genotype : null,
        repColumn: analysisContext === "genetic" ? rep : null,
        environmentColumn:
          analysisContext === "genetic" && resolution?.mode === "multi" ? environment : null,
        traitColumns: traits,
        method,
        mode: analysisContext === "genetic" ? resolution?.mode ?? "single" : "single",
      });

      const response = await vivaSenseRequest<RelationshipResult>("/genetics/correlation", {
        method: "POST",
        jsonBody: request,
        timeoutMs: analysisContext === "genetic" ? 180000 : 30000,
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Relationship Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 md:px-10">
        <Button type="button" variant="outline" size="sm" className="mb-5" onClick={() => navigate("/workspace")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Research Workspace
        </Button>

        <div className="mb-7">
          <div className="mb-2 inline-flex items-center rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
            REL-OPEN-B0 · Relationship Analysis
          </div>
          <div className="flex items-start gap-3">
            <FlaskConical className="mt-1 h-7 w-7 shrink-0 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Relationship Analysis</h1>
              <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground md:text-base">
                Study relationships among numeric variables, with a separate governed mode for replicated genetic entries.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Regression and path analysis remain outside this validated Relationship Analysis workflow.
              </p>
            </div>
          </div>
        </div>

        <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
          <h2 className="font-semibold">Choose analysis context</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            General Correlation is the default. Breeding & Genetic Relationships is an explicit opt-in for replicated genetic material.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              aria-pressed={analysisContext === "general"}
              onClick={() => changeContext("general")}
              className={`rounded-lg border p-4 text-left transition ${
                analysisContext === "general" ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="font-semibold">General Correlation</div>
              <p className="mt-1 text-sm text-muted-foreground">
                For ordinary relationships among numeric variables. No genotype or replication mapping is required.
              </p>
            </button>
            <button
              type="button"
              aria-pressed={analysisContext === "genetic"}
              onClick={() => changeContext("genetic")}
              className={`rounded-lg border p-4 text-left transition ${
                analysisContext === "genetic" ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="font-semibold">Breeding & Genetic Relationships</div>
              <p className="mt-1 text-sm text-muted-foreground">
                For replicated genetic entries such as varieties, lines, hybrids, accessions, families or clones.
              </p>
            </button>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm md:p-7">
          <section className="space-y-3">
            <div>
              <h2 className="font-semibold">1. Upload dataset</h2>
              <p className="text-sm text-muted-foreground">
                {analysisContext === "general"
                  ? "Use CSV or Excel data containing at least two numeric variables."
                  : "Use CSV or Excel data containing genetic entries, replication/block, and at least two numeric traits."}
              </p>
            </div>

            {!file ? (
              <label className="relative block cursor-pointer rounded-lg border-2 border-dashed border-border bg-muted/20 px-6 py-10 text-center hover:border-primary/40">
                <UploadCloud className="mx-auto mb-3 h-9 w-9 text-primary" />
                <span className="block font-medium">Choose a dataset</span>
                <span className="mt-1 block text-sm text-muted-foreground">.csv, .xlsx or .xls</span>
                <Input
                  aria-label="Upload relationship dataset"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{columns.length} columns · {numericColumns.length} numeric</p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={removeFile} aria-label="Remove dataset">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {parseError && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </section>

          {columns.length > 0 && (
            <>
              {analysisContext === "genetic" && (
                <section className="space-y-4 border-t border-border pt-6">
                  <div>
                    <h2 className="font-semibold">2. Confirm genetic context and map the design</h2>
                    <p className="text-sm text-muted-foreground">
                      Genetic quantities are available only when the entries are genuinely genetic material.
                    </p>
                  </div>

                  <fieldset className="rounded-lg border border-border p-4">
                    <legend className="px-1 text-sm font-medium">
                      Are the entries genetic materials (for example varieties, lines, hybrids, accessions, families or clones)? *
                    </legend>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="genetic-material"
                          value="yes"
                          checked={geneticMaterialAnswer === "yes"}
                          onChange={() => setGeneticMaterialAnswer("yes")}
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="genetic-material"
                          value="no"
                          checked={geneticMaterialAnswer === "no"}
                          onChange={() => setGeneticMaterialAnswer("no")}
                        />
                        No
                      </label>
                    </div>
                  </fieldset>

                  {geneticMaterialAnswer === "no" && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-medium">Genetic analysis will not run for these entries.</p>
                          <p className="mt-1">
                            Fixed treatments such as fertilizer rates, tillage methods or irrigation regimes must not be interpreted as genetic material.
                          </p>
                          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => changeContext("general")}>
                            Use General Correlation instead
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm font-medium">
                      <span>Genotype / entry column *</span>
                      <select
                        aria-label="Genotype / entry column"
                        value={genotype}
                        onChange={(e) => { setGenotype(e.target.value); setTraits([]); }}
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Select column</option>
                        {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </label>

                    <label className="space-y-1.5 text-sm font-medium">
                      <span>Replication / Block column *</span>
                      <select
                        aria-label="Replication / Block column"
                        value={rep}
                        onChange={(e) => { setRep(e.target.value); setTraits([]); }}
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Select column</option>
                        {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-1.5 text-sm font-medium">
                    <span>Environment column (optional for a single-environment trial)</span>
                    <select
                      aria-label="Environment column"
                      value={environment}
                      onChange={(e) => { setEnvironment(e.target.value); setTraits([]); }}
                      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">None — analyse as single environment</option>
                      {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </label>
                </section>
              )}

              <section className="space-y-4 border-t border-border pt-6">
                <div>
                  <h2 className="font-semibold">{analysisContext === "general" ? "2" : "3"}. Choose correlation method and variables</h2>
                  <p className="text-sm text-muted-foreground">
                    {analysisContext === "general"
                      ? "Pearson measures linear association; Spearman measures monotonic rank association."
                      : "Pearson/Spearman applies to observed plot-level and genotype-mean correlations only; it does not redefine the model-based rg estimator."}
                  </p>
                </div>

                <label className="block space-y-1.5 text-sm font-medium">
                  <span>Correlation method *</span>
                  <select
                    aria-label="Correlation method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as RelationshipCorrelationMethod)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="pearson">Pearson</option>
                    <option value="spearman">Spearman</option>
                  </select>
                </label>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Numeric {analysisContext === "general" ? "variables" : "traits"} *</p>
                      <p className="text-xs text-muted-foreground">Select at least two ({traits.length} selected).</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setTraits([])} disabled={traits.length === 0}>
                      Clear
                    </Button>
                  </div>

                  {availableTraits.length === 0 ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      No eligible numeric variables remain for this analysis.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {availableTraits.map((column) => (
                        <label
                          key={column.name}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm ${
                            traits.includes(column.name) ? "border-primary bg-primary-soft" : "border-border bg-background"
                          }`}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Variable ${column.name}`}
                            checked={traits.includes(column.name)}
                            onChange={() => toggleTrait(column.name)}
                          />
                          <span className="truncate">{column.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <div className="flex justify-end border-t border-border pt-6">
                <Button type="submit" disabled={!canRun}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running Relationship Analysis…
                    </>
                  ) : (
                    analysisContext === "general" ? "Run General Correlation" : "Run Breeding & Genetic Relationships"
                  )}
                </Button>
              </div>
            </>
          )}
        </form>

        {error && (
          <div className="mt-6 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {analysisContext === "genetic" && environmentResolution && (
          <div className="mt-6 rounded-lg border border-border bg-card p-4 text-sm">
            <p className="font-medium">Runtime environment classification</p>
            <p className="mt-1 text-muted-foreground">
              Mode sent to the backend: <strong className="text-foreground">{environmentResolution.mode}</strong>
              {environment ? ` · distinct Environment levels: ${environmentResolution.distinctCount}` : ""}
            </p>
            {environmentResolution.downgradeReason && (
              <p className="mt-2 text-amber-800">{environmentResolution.downgradeReason}</p>
            )}
          </div>
        )}

        {result && (
          <section className="mt-6 space-y-4" aria-label="Relationship analysis results">
            {warnings.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <ShieldAlert className="h-4 w-4" />
                  Scientific warnings from the analysis engine
                </div>
                <ul className="list-disc space-y-1 pl-5">
                  {warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                </ul>
              </div>
            )}

            {analysisContext === "general" ? (
              <GeneralCorrelationResults result={result} />
            ) : (
              <VivaSenseResultsDisplay result={result} />
            )}
          </section>
        )}
      </div>
    </Layout>
  );
}
