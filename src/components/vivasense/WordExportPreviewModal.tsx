import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileText, AlertCircle } from "lucide-react";
import { downloadVivaSenseDocument, type VsDocumentInput } from "@/lib/vivasenseWordReport";
import { Paragraph } from "docx";

export interface WordExportOptions {
  includeInterpretation: boolean;
  includeTables: boolean;
  includePlots: boolean;
  includeSummary: boolean;
}

interface WordExportPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Module type for header (e.g., "Regression", "ANOVA") */
  moduleType?: string;
  /** Context line (e.g., "Linear model · n = 25") */
  contextLine?: string;
  /** Document body content (Paragraphs/Tables). If not provided, uses placeholder. */
  bodyContent?: (Paragraph | any)[];
  /** Filename for download (without .docx extension) */
  filename?: string;
  onExport?: (options: WordExportOptions) => Promise<void> | void;
  isExporting?: boolean;
}

/**
 * WordExportPreviewModal — Pro-tier component for exporting analysis results to Word format.
 * Allows users to customize which sections are included in the export.
 */
export function WordExportPreviewModal({
  open,
  onOpenChange,
  title = "Export to Word",
  moduleType = "Analysis",
  contextLine,
  bodyContent,
  filename = "VivaSense_Report",
  onExport,
  isExporting = false,
}: WordExportPreviewModalProps) {
  const [options, setOptions] = useState<WordExportOptions>({
    includeInterpretation: true,
    includeTables: true,
    includePlots: true,
    includeSummary: true,
  });
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExportError(null);
    try {
      // Use real vivasenseWordReport export logic
      const docInput: VsDocumentInput = {
        header: {
          moduleType,
          contextLine,
          date: new Date(),
        },
        body: bodyContent || [new Paragraph("Export content not provided for this analysis.")],
      };

      await downloadVivaSenseDocument(docInput, `${filename}.docx`);
      onOpenChange(false);

      // Also call optional custom handler if provided
      if (onExport) {
        await onExport(options);
      }
    } catch (error) {
      console.error("Export failed:", error);
      setExportError(String(error));
    }
  };

  const toggleOption = (key: keyof WordExportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Select which sections to include in your Word document:
          </p>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={options.includeSummary}
                onCheckedChange={() => toggleOption("includeSummary")}
              />
              <span className="text-sm font-medium">Analysis Summary</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={options.includeTables}
                onCheckedChange={() => toggleOption("includeTables")}
              />
              <span className="text-sm font-medium">Statistical Tables</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={options.includeInterpretation}
                onCheckedChange={() => toggleOption("includeInterpretation")}
              />
              <span className="text-sm font-medium">Interpretation & Insights</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={options.includePlots}
                onCheckedChange={() => toggleOption("includePlots")}
              />
              <span className="text-sm font-medium">Plots & Visualizations</span>
            </label>
          </div>

          <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            Publication-ready formatting will be applied to all selected sections.
          </div>

          {exportError && (
            <div className="rounded-sm border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{exportError}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-2">
            {isExporting ? (
              <>Exporting...</>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export to Word
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
