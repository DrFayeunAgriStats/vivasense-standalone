import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, FileSpreadsheet, Code } from "lucide-react";
import type { DatasetContext } from "@/types/geneticsUpload";

interface Props {
  datasetContext: DatasetContext | null;
}

/**
 * RegressionAnalysisTab — Simple Linear Regression Analysis
 *
 * ⚠️ STATUS: NOT YET IMPLEMENTED
 *
 * History: The VivaSenseGeneticsForm has a regression UI option that collects
 * response and predictor variables, but handleGeneticsSubmit() was never wired
 * to call a regression endpoint. No computeRegression() function exists in
 * geneticsUploadApi.ts.
 *
 * Expected to support: Simple linear regression (as per original PWA scope),
 * with coefficients, p-values, R², and confidence intervals.
 * NOT multiple regression with stepwise selection or VIF diagnostics.
 */
export function RegressionAnalysisTab({ datasetContext }: Props) {
  if (!datasetContext) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center space-y-3">
          <TrendingUp className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">
            Upload a dataset first to perform regression analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 flex items-center gap-2 text-sm">
        <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
        <span>
          Using: <span className="font-medium">{datasetContext.file.name}</span>
        </span>
        <Badge variant="outline" className="ml-auto text-xs">
          {datasetContext.availableTraitColumns.length} traits · {datasetContext.mode} mode
        </Badge>
      </div>

      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <AlertCircle className="h-5 w-5" />
            Linear Regression Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-amber-900 dark:text-amber-200">
          <div className="space-y-3">
            <p className="font-semibold">⚠️ Not yet implemented</p>

            <p className="text-sm">
              This feature is <strong>not yet connected</strong> to the backend. The UI form exists in VivaSenseGeneticsForm,
              but the API integration was never completed.
            </p>

            <div className="rounded-sm bg-amber-900/10 p-3 space-y-2 border border-amber-900/20">
              <p className="text-xs font-mono font-semibold">Implementation Status:</p>
              <ul className="text-xs space-y-1 font-mono">
                <li>✅ Form UI in VivaSenseGeneticsForm.tsx</li>
                <li>✅ Result display types in RegressionResultsDisplay.tsx</li>
                <li>❌ computeRegression() function (missing from geneticsUploadApi.ts)</li>
                <li>❌ Backend wiring in handleGeneticsSubmit() (hardcoded to correlations)</li>
              </ul>
            </div>

            <p className="text-sm">
              <strong>What needs to be done:</strong>
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-sm">
              <li>Implement <code className="text-xs bg-black/20 px-1 rounded">computeRegression()</code> in geneticsUploadApi.ts</li>
              <li>Update <code className="text-xs bg-black/20 px-1 rounded">handleGeneticsSubmit()</code> to branch on regression</li>
              <li>Wire to backend endpoint <code className="text-xs bg-black/20 px-1 rounded">/genetics/regression</code> or similar</li>
              <li>Ensure backend supports: coefficients, p-values, R², confidence intervals</li>
              <li>Scope to simple linear regression (matching original PWA), not stepwise/VIF</li>
            </ol>

            <p className="text-sm italic">
              The UI is ready. Only backend integration is missing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
