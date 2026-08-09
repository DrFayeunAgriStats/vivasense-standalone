import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2, FileSpreadsheet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadPreview, fileToBase64 } from "@/lib/geneticsUploadApi";
import { resolveEnvironmentMode } from "@/lib/environmentValidation";
import type { DatasetContext, UploadPreviewResponse } from "@/types/geneticsUpload";

interface Props {
  onDatasetReady: (ctx: DatasetContext) => void;
  datasetContext: DatasetContext | null;
}

export function DatasetUpload({ onDatasetReady, datasetContext }: Props) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreviewResponse | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const [genotypeCol, setGenotypeCol] = useState("");
  const [repCol, setRepCol] = useState("");
  const [envCol, setEnvCol] = useState("");
  // Environment factors, used only when no explicit Environment column is set.
  const [locationCol, setLocationCol] = useState("");
  const [yearCol, setYearCol] = useState("");
  const [mode, setMode] = useState<"single" | "multi">("single");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setIsPreviewing(true);
    setPreview(null);
    try {
      const res = await uploadPreview(file);
      setPreview(res);
      setGenotypeCol(res.detected_columns.genotype?.column ?? "");
      setRepCol(res.detected_columns.rep?.column ?? "");
      setEnvCol(res.detected_columns.environment?.column ?? "");
      setMode(res.mode_suggestion);
    } catch (err: any) {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleConfirmMapping = async () => {
    // repCol is optional: CRD (completely randomized) datasets have no replication
    // column. The backend infers CRD when rep_column is empty/null.
    if (!file || !preview || !genotypeCol) return;
    try {
      const base64 = await fileToBase64(file);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "csv";

      // Guard: a "multi" run is only valid when the environment column has ≥2
      // distinct levels. Otherwise the backend would compute impossible
      // Environment / GxE statistics. Downgrade to single-environment mode and
      // tell the user before they interpret results that don't exist.
      // Environment factors participate only when no explicit column is set —
      // an explicitly mapped Environment column always takes precedence.
      const envFactors = !envCol && locationCol && yearCol ? [locationCol, yearCol] : [];

      const { mode: effectiveMode, downgradeReason } = await resolveEnvironmentMode(
        file,
        envCol || null,
        mode,
        envFactors
      );
      if (downgradeReason) {
        setMode("single");
        toast({
          title: "Single-environment analysis",
          description: downgradeReason,
        });
      }

      const ctx: DatasetContext = {
        file,
        base64Content: base64,
        fileType: ext as "csv" | "xlsx" | "xls",
        genotypeColumn: genotypeCol,
        repColumn: repCol,
        environmentColumn: envCol || null,
        environmentFactorColumns: envFactors,
        availableTraitColumns: preview.detected_columns.traits,
        mode: effectiveMode,
        datasetToken: preview.dataset_token ?? null,
        // All column names — lets design selectors (factorial / split-plot) offer
        // every non-trait column as a candidate factor/plot role.
        columns: preview.column_names,
        availableColumns: preview.column_names,
      };
      onDatasetReady(ctx);
      toast({ title: "Dataset ready", description: "You can now run analysis in any module." });
    } catch (err: any) {
      toast({ title: "Error preparing dataset", description: err.message, variant: "destructive" });
    }
  };

  // If dataset already loaded, show compact summary
  if (datasetContext) {
    return (
      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
        <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Dataset loaded: <span className="text-emerald-700 dark:text-emerald-400">{datasetContext.file.name}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {datasetContext.availableTraitColumns.length} traits available · {datasetContext.mode} mode
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onDatasetReady(null as any);
              setFile(null);
              setPreview(null);
            }}
          >
            Upload New Dataset
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload Dataset
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} className="flex-1" />
            <Button onClick={handlePreview} disabled={!file || isPreviewing} className="gap-2">
              {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Preview
            </Button>
          </div>
          {file && <p className="text-xs text-muted-foreground">Selected: <span className="font-medium">{file.name}</span></p>}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Column Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{preview.n_rows} rows</Badge>
              <Badge variant="secondary">{preview.n_columns} columns</Badge>
              <Badge variant="outline">Suggested: {preview.mode_suggestion}</Badge>
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200 dark:border-yellow-700">
                <div className="flex items-center gap-2 mb-1 font-medium">
                  <AlertTriangle className="h-4 w-4" /> Warnings
                </div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Genotype Column</Label>
                <Select value={genotypeCol} onValueChange={setGenotypeCol}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {preview.column_names.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Rep Column</Label>
                <Select value={repCol || "__none__"} onValueChange={(v) => setRepCol(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="None (CRD)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (CRD — no blocking)</SelectItem>
                    {preview.column_names.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Environment Column</Label>
                <Select value={envCol || "__none__"} onValueChange={(v) => setEnvCol(v === "__none__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {preview.column_names.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as "single" | "multi")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Environment</SelectItem>
                    <SelectItem value="multi">Multi-Environment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/*
              Location + Year are captured as their own fields rather than
              competing for the single Environment slot. A trial at 3 locations
              over 3 years has 9 environments, not 3; forcing one of them into
              "Environment" (and the other into Rep) silently describes a
              different experiment. Only used when Environment Column is None.
            */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium">
                    Environment built from Location × Year
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use these when your trial spans several locations <em>and</em> several
                    years and you have no single Environment column.
                  </p>
                </div>
                {envCol && (
                  <span className="text-xs rounded-md bg-muted px-2 py-1 text-muted-foreground">
                    Not used — “{envCol}” is set as the Environment column
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Location Column</Label>
                  <Select
                    value={locationCol || "__none__"}
                    onValueChange={(v) => setLocationCol(v === "__none__" ? "" : v)}
                    disabled={!!envCol}
                  >
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {preview.column_names.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Year / Season Column</Label>
                  <Select
                    value={yearCol || "__none__"}
                    onValueChange={(v) => setYearCol(v === "__none__" ? "" : v)}
                    disabled={!!envCol}
                  >
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {preview.column_names.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!envCol && locationCol && yearCol && (
                <p className="text-xs text-muted-foreground">
                  Environment will be constructed as{" "}
                  <span className="font-medium text-foreground">
                    {locationCol} × {yearCol}
                  </span>
                  , and replication treated as nested within it. The exact number of
                  environments is confirmed by the backend when the analysis runs.
                </p>
              )}
              {!envCol && !!locationCol !== !!yearCol && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Both Location and Year are needed to construct an environment. With
                  only one set, the data is analysed as single-environment.
                </p>
              )}
            </div>

            {/* Data preview */}
            {preview.data_preview.length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-sm font-medium mb-2">Data Preview (first rows)</p>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      {preview.column_names.map((c) => (
                        <th key={c} className="border border-border px-2 py-1.5 bg-muted font-medium text-left">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data_preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="even:bg-muted/30">
                        {preview.column_names.map((c) => (
                          <td key={c} className="border border-border px-2 py-1">{String(row[c] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              onClick={handleConfirmMapping}
              disabled={!genotypeCol}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Mapping & Prepare Dataset
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
