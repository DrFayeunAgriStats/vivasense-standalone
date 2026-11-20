import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import {
  CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fitSimpleRegression, formatNumber, previewRegression, regressionReport, residualPoints, REGRESSION_SCOPE,
  RESIDUAL_PLOT_DESCRIPTION, type ReportSection, type ResidualPoint, type SimpleRegressionResult,
} from "@/lib/simpleRegression";

const control = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const OBSERVED = "#1b7872";
const FLAGGED = "#c2410c";

async function downloadWord(result: SimpleRegressionResult) {
  const { downloadRegressionWord } = await import("@/lib/regressionWordReport");
  await downloadRegressionWord(result);
}

/** Renders nothing: lets a Scatter series draw only its connecting line. */
const NoDot = () => <g />;

function PointTooltip({ result, active, payload }: {
  result: SimpleRegressionResult; active?: boolean; payload?: { payload?: ResidualPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point || point.fitted === undefined) return null;
  return (
    <div className="rounded border border-border bg-background p-2 text-xs shadow" role="status">
      <p className="font-medium">{point.sourceRow != null ? `Data row ${point.sourceRow}` : "Data row not available for this result"}</p>
      <p>{result.x_variable}: {formatNumber(point.x)}</p>
      <p>{result.y_variable}: {formatNumber(point.y)}</p>
      <p>Fitted: {formatNumber(point.fitted)}</p>
      <p>Residual: {formatNumber(point.residual)}</p>
      {point.leverage != null && <p>Leverage: {formatNumber(point.leverage)}</p>}
      {point.leverage != null && <p>Cook&apos;s distance: {formatNumber(point.cooksDistance)}</p>}
      {point.flagged && <p className="font-medium">Flagged by influence screening</p>}
    </div>
  );
}

function RegressionPlot({ result }: { result: SimpleRegressionResult }) {
  const points = residualPoints(result);
  const regular = points.filter((p) => !p.flagged);
  const flagged = points.filter((p) => p.flagged);
  const { x, fitted_y } = result.plot_data;
  // Straight line between the fitted values at the smallest and largest X.
  const line = x.length ? [{ x: x[0], y: fitted_y[0] }, { x: x[x.length - 1], y: fitted_y[fitted_y.length - 1] }] : [];
  return (
    <figure className="space-y-2" data-testid="regression-fitted-plot">
      <figcaption className="text-sm font-medium">Observed values and fitted line</figcaption>
      <div className="h-72 w-full" role="img" aria-label={`Observed ${result.y_variable} versus ${result.x_variable}, with fitted line`}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 16, bottom: 35, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name={result.x_variable} domain={["auto", "auto"]}
              label={{ value: result.x_variable, position: "bottom" }} />
            <YAxis type="number" dataKey="y" name={result.y_variable} domain={["auto", "auto"]}
              label={{ value: result.y_variable, angle: -90, position: "insideLeft" }} />
            <Tooltip content={<PointTooltip result={result} />} />
            <Scatter name="Fitted line" data={line} line={{ stroke: "#b65c22", strokeWidth: 2 }} shape={NoDot}
              legendType="line" isAnimationActive={false} tooltipType="none" />
            <Scatter name="Observed values" data={regular} fill={OBSERVED} isAnimationActive={false} />
            {flagged.length > 0 && (
              <Scatter name="Flagged observations" data={flagged} fill={FLAGGED} shape="diamond" isAnimationActive={false} />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function ResidualPlot({ result }: { result: SimpleRegressionResult }) {
  const points = residualPoints(result).map((p) => ({ ...p, plotX: p.fitted, plotY: p.residual }));
  const regular = points.filter((p) => !p.flagged);
  const flagged = points.filter((p) => p.flagged);
  return (
    <figure className="space-y-2" data-testid="regression-residual-plot">
      <figcaption className="text-sm font-medium">Residuals versus fitted values</figcaption>
      <p className="text-xs text-muted-foreground">{RESIDUAL_PLOT_DESCRIPTION}</p>
      <div className="h-72 w-full" role="img"
        aria-label={`Residuals versus fitted values for ${points.length} observations, with a horizontal line at zero`}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 16, bottom: 35, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="plotX" name="Fitted value" domain={["auto", "auto"]}
              label={{ value: `Fitted ${result.y_variable}`, position: "bottom" }} />
            <YAxis type="number" dataKey="plotY" name="Residual" domain={["auto", "auto"]}
              label={{ value: "Residual", angle: -90, position: "insideLeft" }} />
            <ReferenceLine y={0} stroke="#333333" strokeWidth={1.5} ifOverflow="extendDomain"
              label={{ value: "0", position: "left" }} />
            <Tooltip content={<PointTooltip result={result} />} />
            <Scatter name="Residuals" data={regular} fill={OBSERVED} isAnimationActive={false} />
            {flagged.length > 0 && (
              <Scatter name="Flagged observations" data={flagged} fill={FLAGGED} shape="diamond" isAnimationActive={false} />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Text alternative to both plots: every observation, keyboard-reachable via <details>. */
function ObservationTable({ result }: { result: SimpleRegressionResult }) {
  const points = residualPoints(result);
  const linked = points.some((p) => p.sourceRow != null);
  const influence = points.some((p) => p.leverage != null);
  return (
    <details className="rounded-md border border-border text-sm" data-testid="regression-observation-table">
      <summary className="cursor-pointer px-3 py-2 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Observation diagnostics ({points.length} observations)
      </summary>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          <caption className="sr-only">Per-observation fitted values, residuals and influence diagnostics</caption>
          <thead className="bg-muted/50">
            <tr>
              {[...(linked ? ["Data row"] : []), result.x_variable, result.y_variable, "Fitted", "Residual",
                ...(influence ? ["Leverage", "Cook's distance", "Flagged"] : [])].map((h) => (
                <th key={h} scope="col" className="border-b border-border px-2 py-1.5 text-right font-medium first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p.sourceRow ?? `i${i}`} className={p.flagged ? "bg-orange-50 dark:bg-orange-950/20" : undefined}>
                {linked && <th scope="row" className="border-b border-border px-2 py-1 text-left font-normal">{p.sourceRow}</th>}
                <td className="border-b border-border px-2 py-1 text-right tabular-nums">{formatNumber(p.x)}</td>
                <td className="border-b border-border px-2 py-1 text-right tabular-nums">{formatNumber(p.y)}</td>
                <td className="border-b border-border px-2 py-1 text-right tabular-nums">{formatNumber(p.fitted)}</td>
                <td className="border-b border-border px-2 py-1 text-right tabular-nums">{formatNumber(p.residual)}</td>
                {influence && <td className="border-b border-border px-2 py-1 text-right tabular-nums">{formatNumber(p.leverage)}</td>}
                {influence && <td className="border-b border-border px-2 py-1 text-right tabular-nums">{formatNumber(p.cooksDistance)}</td>}
                {influence && <td className="border-b border-border px-2 py-1 text-right">{p.flagged ? "yes" : ""}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function ReportSectionView({ section }: { section: ReportSection }) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">{section.title}</h3>
      {section.rows.length > 0 && (
        <dl className="divide-y rounded-md border border-border text-sm">
          {section.rows.map(([label, value]) => (
            <div key={value + label} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-3">
              <dt className="font-medium">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {(section.tables ?? []).map((table) => (
        <figure key={table.caption} className="space-y-1">
          <figcaption className="text-xs text-muted-foreground">{table.caption}</figcaption>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} scope="col" className={`whitespace-nowrap border-b border-border px-3 py-2 font-medium ${i >= table.numericFrom ? "text-right" : "text-left"}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.join("|")}>
                    {row.map((v, i) => i === 0 ? (
                      <th key={i} scope="row" className="whitespace-nowrap border-b border-border px-3 py-2 text-left font-normal">{v}</th>
                    ) : (
                      <td key={i} className={`whitespace-nowrap border-b border-border px-3 py-2 tabular-nums ${i >= table.numericFrom ? "text-right" : "text-left"}`}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      ))}
      {(section.notes ?? []).map((note) => <p key={note} className="text-sm text-muted-foreground">{note}</p>)}
    </section>
  );
}

export default function SimpleRegressionAnalysis() {
  const [upload, setUpload] = useState<Awaited<ReturnType<typeof previewRegression>> | null>(null);
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [alpha, setAlpha] = useState(0.05);
  const [busy, setBusy] = useState<"upload" | "analysis" | "export" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SimpleRegressionResult | null>(null);

  function resetResult() {
    setResult(null);
    setError("");
  }

  async function load(file?: File) {
    resetResult();
    setUpload(null);
    setX("");
    setY("");
    if (!file) return;

    setBusy("upload");
    try {
      setUpload(await previewRegression(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the dataset.");
    } finally {
      setBusy(null);
    }
  }

  async function run(event: FormEvent) {
    event.preventDefault();
    if (!upload || !x || !y || x === y || busy) return;
    resetResult();
    setBusy("analysis");
    try {
      setResult(await fitSimpleRegression(upload.dataset_token, x, y, alpha));
    } catch (err) {
      let message = err instanceof Error ? err.message : "Could not fit the regression.";
      try {
        const parsed = JSON.parse(message);
        message = parsed.detail?.message || message;
      } catch {
        // Standalone deployments may return plain error text.
      }
      setError(message);
    } finally {
      setBusy(null);
    }
  }

  async function exportWord(current: SimpleRegressionResult) {
    setError("");
    setBusy("export");
    try {
      await downloadWord(current);
    } catch {
      setError("Could not create the Word report. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl space-y-5 p-5 md:p-8">
        <Link to="/workspace" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Research Workspace
        </Link>
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Simple Linear Regression</h1>
          <p className="text-sm text-muted-foreground">Fit a line to describe the association between one numeric predictor and one numeric response.</p>
          <p className="text-sm text-muted-foreground">{REGRESSION_SCOPE}</p>
        </header>
        <form onSubmit={run} className="space-y-4 rounded-xl border border-border bg-card p-5">
          <label className="block space-y-2 text-sm font-medium">
            <span>Dataset (CSV or Excel .xlsx)</span>
            <Input type="file" accept=".csv,.xlsx" disabled={!!busy} onClick={(event) => { event.currentTarget.value = ""; }}
              onChange={(event) => { void load(event.target.files?.[0]); }} />
          </label>
          {busy === "upload" && <p role="status" className="text-sm">Reading dataset…</p>}
          {upload && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-2 text-sm font-medium">
                <span>Predictor (X)</span>
                <select className={control} value={x} disabled={!!busy}
                  onChange={(event) => { setX(event.target.value); resetResult(); }}>
                  <option value="">Choose predictor</option>
                  {upload.numeric_columns.map((column) => <option key={column} disabled={column === y}>{column}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Response (Y)</span>
                <select className={control} value={y} disabled={!!busy}
                  onChange={(event) => { setY(event.target.value); resetResult(); }}>
                  <option value="">Choose response</option>
                  {upload.numeric_columns.map((column) => <option key={column} disabled={column === x}>{column}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Significance level (α)</span>
                <select className={control} value={alpha} disabled={!!busy}
                  onChange={(event) => { setAlpha(Number(event.target.value)); resetResult(); }}>
                  <option value={0.01}>0.01 (99% confidence)</option>
                  <option value={0.05}>0.05 (95% confidence)</option>
                  <option value={0.10}>0.10 (90% confidence)</option>
                </select>
              </label>
            </div>
          )}
          <Button type="submit" disabled={!!busy || !x || !y || x === y}>
            {busy === "analysis" ? "Fitting regression…" : "Run Regression"}
          </Button>
        </form>
        {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
        {result && (
          <section className="space-y-5 rounded-xl border border-border bg-card p-5" aria-label="Regression results">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Regression Results</h2>
              <Button variant="outline" disabled={!!busy} onClick={() => void exportWord(result)}>
                <Download className="mr-2 h-4 w-4" /> {busy === "export" ? "Preparing report…" : "Download Word report"}
              </Button>
            </div>
            {regressionReport(result).map((section) => (
              <div key={section.title} className="space-y-4">
                {section.title === "Model and slope inference" && <RegressionPlot result={result} />}
                {section.title === "Residual diagnostics" && <ResidualPlot result={result} />}
                <ReportSectionView section={section} />
                {section.title === "Residual diagnostics" && <ObservationTable result={result} />}
              </div>
            ))}
          </section>
        )}
      </div>
    </Layout>
  );
}
