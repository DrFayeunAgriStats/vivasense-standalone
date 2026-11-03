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

const NA_TOKENS = new Set(["", "na", "n/a", "nan", "null", "none", "-", "--"]);

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

export default function RelationshipAnalysis() {
  const navigate = useNavigate();
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
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [environmentResolution, setEnvironmentResolution] = useState<EnvironmentResolution | null>(null);

  const numericColumns = useMemo(() => columns.filter((c) => c.isNumeric), [columns]);
  const availableTraits = useMemo(
    () => numericColumns.filter((c) => ![genotype, rep, environment].includes(c.name)),
    [numericColumns, genotype, rep, environment],
  );

  const warnings = useMemo(() => {
    if (!result || !Array.isArray(result.warnings)) return [];
    return result.warnings.map((w) => String(w)).filter(Boolean);
  }, [result]);

  const canRun = Boolean(file && genotype && rep && traits.length >= 2 && !isLoading);

  const resetMapping = () => {
    setGenotype("");
    setRep("");
    setEnvironment("");
    setTraits([]);
    setMethod("pearson");
    setEnvironmentResolution(null);
    setResult(null);
    setError(null);
  };

  const parseFile = async (nextFile: File) => {
    setParseError(null);
    resetMapping();
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
    resetMapping();
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
      const requestedMode: RelationshipCorrelationMode = environment ? "multi" : "single";
      const resolution = await resolveEnvironmentMode(
        file,
        environment || null,
        requestedMode,
        [],
      );
      setEnvironmentResolution(resolution);

      const base64Content = await fileToBase64(file);
      const request = buildRelationshipCorrelationRequest({
        base64Content,
        fileType: fileTypeFor(file),
        genotypeColumn: genotype,
        repColumn: rep,
        environmentColumn: resolution.mode === "multi" ? environment : null,
        traitColumns: traits,
        method,
        mode: resolution.mode,
      });

      const response = await vivaSenseRequest<Record<string, unknown>>("/genetics/correlation", {
        method: "POST",
        jsonBody: request,
        timeoutMs: 180000,
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mb-5"
          onClick={() => navigate("/workspace")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Research Workspace
        </Button>

        <div className="mb-7">
          <div className="mb-2 inline-flex items-center rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
            CORR-SCI-02 · Relationship Analysis
          </div>
          <div className="flex items-start gap-3">
            <FlaskConical className="mt-1 h-7 w-7 shrink-0 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Relationship Analysis</h1>
              <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground md:text-base">
                Compare observed plot-level association, correlation of genotype means, and model-based genotypic correlation (rg) without treating them as the same quantity.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                This release surface is correlation-only. Regression and path analysis remain outside the validated Relationship Analysis workflow.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-5 shadow-sm md:p-7">
          <section className="space-y-3">
            <div>
              <h2 className="font-semibold">1. Upload dataset</h2>
              <p className="text-sm text-muted-foreground">
                Use CSV or Excel data containing genotype, replication/block, and at least two numeric traits.
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
                  <p className="text-xs text-muted-foreground">
                    {columns.length} columns · {numericColumns.length} numeric
                  </p>
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
              <section className="space-y-4 border-t border-border pt-6">
                <div>
                  <h2 className="font-semibold">2. Map the experimental structure</h2>
                  <p className="text-sm text-muted-foreground">
                    Environment is optional for a single-environment trial and required for a multi-environment trial.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium">
                    <span>Genotype column *</span>
                    <select
                      aria-label="Genotype column"
                      value={genotype}
                      onChange={(e) => {
                        setGenotype(e.target.value);
                        setTraits([]);
                      }}
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
                      onChange={(e) => {
                        setRep(e.target.value);
                        setTraits([]);
                      }}
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
                    onChange={(e) => {
                      setEnvironment(e.target.value);
                      setTraits([]);
                    }}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">None — analyse as single environment</option>
                    {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </label>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      If an Environment column is selected, VivaSense counts its distinct levels before submission. Two or more levels are sent as <strong>multi-environment</strong>, which triggers the governed suppression of pooled rg. A one-level column is downgraded to single-environment with an explicit notice.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-t border-border pt-6">
                <div>
                  <h2 className="font-semibold">3. Choose correlation method and traits</h2>
                  <p className="text-sm text-muted-foreground">
                    Pearson/Spearman applies to observed plot-level and genotype-mean correlations only. It does not change the model-based rg estimator.
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
                      <p className="text-sm font-medium">Numeric traits *</p>
                      <p className="text-xs text-muted-foreground">Select at least two traits ({traits.length} selected).</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setTraits([])} disabled={traits.length === 0}>
                      Clear
                    </Button>
                  </div>

                  {availableTraits.length === 0 ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      No numeric traits remain after the design columns are assigned.
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
                            aria-label={`Trait ${column.name}`}
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
                    "Run Relationship Analysis"
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

        {environmentResolution && (
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

            <VivaSenseResultsDisplay result={result} />
          </section>
        )}
      </div>
    </Layout>
  );
}
