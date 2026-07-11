import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import {
  parseAssumptions,
  buildBoxPlotData,
  computeResiduals,
  type RawObservation,
} from "@/lib/assumptions/computeDiagnostics";
import {
  buildOverallBanner,
  interpretShapiro,
  interpretLevene,
  interpretQQ,
  interpretHistogram,
  interpretResidualsVsFitted,
  interpretBoxPlot,
} from "@/lib/assumptions/interpret";
import { ResidualHistogram } from "./charts/ResidualHistogram";
import { QQPlot } from "./charts/QQPlot";
import { ResidualsVsFitted } from "./charts/ResidualsVsFitted";
import { TreatmentBoxPlot } from "./charts/TreatmentBoxPlot";

export interface AssumptionTestsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assumptions?: unknown;
  descriptiveStats?: unknown;
  rawRows?: RawObservation[];
}

export function AssumptionTestsModal({
  open,
  onOpenChange,
  assumptions,
  descriptiveStats,
  rawRows,
}: AssumptionTestsModalProps) {
  const summary = useMemo(() => parseAssumptions(assumptions), [assumptions]);
  const residualPoints = useMemo(() => (rawRows && rawRows.length ? computeResiduals(rawRows) : []), [rawRows]);
  const residuals = residualPoints.map((p) => p.residual);
  const boxData = useMemo(() => buildBoxPlotData(descriptiveStats, residualPoints), [descriptiveStats, residualPoints]);
  const banner = buildOverallBanner(summary);

  const bannerColor =
    banner.level === "pass"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : banner.level === "warn"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-muted bg-muted/30 text-foreground";

  const BannerIcon = banner.level === "pass" ? CheckCircle2 : banner.level === "warn" ? AlertTriangle : Info;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">Assumption Tests &amp; Diagnostic Plots</DialogTitle>
        </DialogHeader>

        <Card className={`border ${bannerColor}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <BannerIcon className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">{banner.title}</p>
                <p className="text-sm opacity-90">{banner.message}</p>
                {banner.actions.length > 0 && (
                  <ul className="mt-2 text-sm list-disc list-inside space-y-0.5">
                    {banner.actions.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="tests" className="mt-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="tests">Tests</TabsTrigger>
            <TabsTrigger value="residuals">Residual Plots</TabsTrigger>
            <TabsTrigger value="boxplot">Box Plot</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>

          {/* TESTS */}
          <TabsContent value="tests" className="space-y-4 mt-4">
            <Card>
              <CardContent className="p-4 space-y-1">
                <h4 className="font-serif font-semibold">Shapiro–Wilk Test (Normality)</h4>
                {summary.shapiro ? (
                  <>
                    <p className="text-sm font-mono">
                      W = {summary.shapiro.statistic?.toFixed(3) ?? "—"} &nbsp; · &nbsp; p = {summary.shapiro.pValue == null ? "—" : summary.shapiro.pValue < 0.001 ? "<0.001" : summary.shapiro.pValue.toFixed(3)}
                    </p>
                    <p className="text-sm text-muted-foreground">{interpretShapiro(summary.shapiro)}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not reported by the backend for this analysis.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-1">
                <h4 className="font-serif font-semibold">Levene's Test (Homogeneity of Variance)</h4>
                {summary.levene ? (
                  <>
                    <p className="text-sm font-mono">
                      F = {summary.levene.statistic?.toFixed(3) ?? "—"} &nbsp; · &nbsp; p = {summary.levene.pValue == null ? "—" : summary.levene.pValue < 0.001 ? "<0.001" : summary.levene.pValue.toFixed(3)}
                    </p>
                    <p className="text-sm text-muted-foreground">{interpretLevene(summary.levene)}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not reported by the backend for this analysis.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* RESIDUALS */}
          <TabsContent value="residuals" className="space-y-6 mt-4">
            {residualPoints.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Residual diagnostic plots require per-observation data. Re-run the analysis with raw observations to view the histogram, Q-Q plot, and residuals-vs-fitted.
                </CardContent>
              </Card>
            ) : (
              <>
                <Card><CardContent className="p-4">
                  <ResidualHistogram residuals={residuals} />
                  <p className="mt-2 text-sm text-muted-foreground">{interpretHistogram(residuals)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <QQPlot residuals={residuals} />
                  <p className="mt-2 text-sm text-muted-foreground">{interpretQQ(residuals)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <ResidualsVsFitted points={residualPoints} />
                  <p className="mt-2 text-sm text-muted-foreground">{interpretResidualsVsFitted(residualPoints)}</p>
                </CardContent></Card>
              </>
            )}
          </TabsContent>

          {/* BOX PLOT */}
          <TabsContent value="boxplot" className="space-y-3 mt-4">
            {boxData.length === 0 ? (
              <Card><CardContent className="p-4 text-sm text-muted-foreground">
                Descriptive statistics (min, Q1, median, Q3, max) are required to render the box plot.
              </CardContent></Card>
            ) : (
              <Card><CardContent className="p-4">
                <TreatmentBoxPlot data={boxData} approximate={residualPoints.length === 0} />
                <p className="mt-2 text-sm text-muted-foreground">{interpretBoxPlot(boxData)}</p>
              </CardContent></Card>
            )}
          </TabsContent>

          {/* SUMMARY */}
          <TabsContent value="summary" className="space-y-3 mt-4 text-sm leading-relaxed">
            <p><strong>Normality:</strong> {interpretShapiro(summary.shapiro)}</p>
            <p><strong>Homogeneity:</strong> {interpretLevene(summary.levene)}</p>
            {residuals.length > 0 && <p><strong>Residual distribution:</strong> {interpretHistogram(residuals)}</p>}
            {residualPoints.length > 0 && <p><strong>Variance pattern:</strong> {interpretResidualsVsFitted(residualPoints)}</p>}
            {boxData.length > 0 && <p><strong>Outliers:</strong> {interpretBoxPlot(boxData)}</p>}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
