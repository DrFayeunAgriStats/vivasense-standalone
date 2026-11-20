import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip } from "recharts";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fitSimpleRegression, previewRegression, regressionReport, REGRESSION_SCOPE, type SimpleRegressionResult,
} from "@/lib/simpleRegression";

const control = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

async function downloadWord(result: SimpleRegressionResult) {
  const { Document, HeadingLevel, Packer, Paragraph, TextRun } = await import("docx");
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "VivaSense Stat | Simple Linear Regression", heading: HeadingLevel.TITLE }),
        ...regressionReport(result).flatMap(({ title, rows }) => [
          new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
          ...rows.map(([label, value]) => new Paragraph({
            children: [new TextRun({ text: `${label}  `, bold: true }), new TextRun(value)],
          })),
        ]),
      ],
    }],
  });
  const url = URL.createObjectURL(await Packer.toBlob(doc));
  const link = document.createElement("a");
  link.href = url;
  link.download = "VivaSense_Simple_Linear_Regression.docx";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RegressionPlot({ result }: { result: SimpleRegressionResult }) {
  const points = result.plot_data.x.map((x, index) => ({
    x, observed: result.plot_data.y[index], fitted: result.plot_data.fitted_y[index],
  }));
  return (
    <figure className="space-y-2">
      <figcaption className="text-sm font-medium">Observed values and fitted line</figcaption>
      <div className="h-72 w-full" role="img" aria-label={`Observed ${result.y_variable} versus ${result.x_variable}, with fitted line`}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 35, left: 20 }}>
            <XAxis type="number" dataKey="x" name={result.x_variable} domain={["auto", "auto"]}
              label={{ value: result.x_variable, position: "bottom" }} />
            <YAxis type="number" dataKey="observed" name={result.y_variable} domain={["auto", "auto"]}
              label={{ value: result.y_variable, angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Scatter name="Observed values" data={points} fill="#1b7872" isAnimationActive={false} />
            <Scatter name="Fitted line" data={[points[0], points[points.length - 1]].map(({ x, fitted }) => ({ x, observed: fitted }))}
              fill="#b65c22" line lineType="joint" isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
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
            <RegressionPlot result={result} />
            {regressionReport(result).map(({ title, rows }) => (
              <section key={title} className="space-y-2">
                <h3 className="font-semibold">{title}</h3>
                <dl className="divide-y rounded-md border border-border text-sm">
                  {rows.map(([label, value]) => (
                    <div key={value + label} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-3">
                      <dt className="font-medium">{label}</dt>
                      <dd className="break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </section>
        )}
      </div>
    </Layout>
  );
}
