/**
 * Dataset upload for the bioassay workflow.
 *
 * Parsing stays on the backend: the file goes to /genetics/upload-preview
 * through the existing uploadPreview service, and the base64 payload is produced
 * by the existing fileToBase64 helper. No second parser is introduced here.
 *
 * Detected columns are shown as information only — no scientific role is
 * assigned from them. Roles are declared explicitly in the next step.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fileToBase64, uploadPreview } from "@/lib/geneticsUploadApi";
import { readableBackendError } from "@/services/cropProtectionApi";
import type { UploadPreviewResponse } from "@/types/geneticsUpload";

export interface BioassayDatasetState {
  file: File;
  base64Content: string;
  fileType: "csv" | "xlsx" | "xls";
  columns: string[];
  rowCount: number;
  preview: Record<string, unknown>[];
}

function resolveFileType(file: File): "csv" | "xlsx" | "xls" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".xls")) return "xls";
  return "xlsx";
}

interface Props {
  dataset: BioassayDatasetState | null;
  onDatasetReady: (dataset: BioassayDatasetState | null) => void;
}

export function BioassayUpload({ dataset, onDatasetReady }: Props) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<UploadPreviewResponse | null>(null);

  const handlePreview = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const [response, base64Content] = await Promise.all([
        uploadPreview(file),
        fileToBase64(file),
      ]);
      setPreview(response);
      onDatasetReady({
        file,
        base64Content,
        fileType: resolveFileType(file),
        columns: response.column_names,
        rowCount: response.n_rows,
        preview: response.data_preview,
      });
    } catch (error) {
      toast({
        title: "Could not read the file",
        description: readableBackendError(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (dataset) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium">
                Dataset loaded:{" "}
                <span className="text-emerald-700 dark:text-emerald-400">
                  {dataset.file.name}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {dataset.rowCount} rows · {dataset.columns.length} columns
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onDatasetReady(null);
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
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-primary" />
            Upload Dataset
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            CSV or Excel. One row per experimental unit, with Treatment, Dose and Replicate
            columns plus one column per measured response.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="flex-1"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) {
                  setFile(selected);
                  setPreview(null);
                }
              }}
            />
            <Button onClick={handlePreview} disabled={!file || isLoading} className="gap-2">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Preview
            </Button>
          </div>
          {file && (
            <p className="text-xs text-muted-foreground">
              Selected: <span className="font-medium">{file.name}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detected columns</CardTitle>
            <p className="text-sm text-muted-foreground">
              Column names only. Scientific roles are declared by you in the next step.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{preview.n_rows} rows</Badge>
              <Badge variant="secondary">{preview.n_columns} columns</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {preview.column_names.map((column) => (
                <Badge key={column} variant="outline" className="font-normal">
                  {column}
                </Badge>
              ))}
            </div>
            {preview.data_preview.length > 0 && (
              <div className="overflow-x-auto">
                <p className="mb-2 text-sm font-medium">Data preview (first rows)</p>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      {preview.column_names.map((column) => (
                        <th
                          key={column}
                          className="border border-border bg-muted px-2 py-1.5 text-left font-medium"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.data_preview.slice(0, 5).map((row, index) => (
                      <tr key={index} className="even:bg-muted/30">
                        {preview.column_names.map((column) => (
                          <td key={column} className="border border-border px-2 py-1">
                            {String(row[column] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
