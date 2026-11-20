/**
 * PNG renderings of the two regression plots for the Word report, drawn on a
 * canvas from the same data the workspace plots use. Returns null where no
 * 2D canvas is available (the report then states that the plot is shown in
 * the workspace only).
 */
import { residualPoints, type SimpleRegressionResult } from "@/lib/simpleRegression";

export const PLOT_WIDTH = 720;
export const PLOT_HEIGHT = 420;

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? 10 * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step) ticks.push(Number(t.toPrecision(12)));
  return ticks;
}

interface Series {
  points: { x: number; y: number; flagged?: boolean }[];
  line?: [number, number][];
  zeroLine?: boolean;
  xLabel: string;
  yLabel: string;
  title: string;
}

function draw(series: Series): Promise<Uint8Array | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  const canvas = document.createElement("canvas");
  canvas.width = PLOT_WIDTH;
  canvas.height = PLOT_HEIGHT;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx) return Promise.resolve(null);

  const m = { left: 80, right: 24, top: 40, bottom: 64 };
  const xs = series.points.map((p) => p.x).concat(series.line?.map(([x]) => x) ?? []);
  const ys = series.points.map((p) => p.y).concat(series.line?.map(([, y]) => y) ?? [], series.zeroLine ? [0] : []);
  const pad = (lo: number, hi: number) => {
    const d = (hi - lo || Math.abs(hi) || 1) * 0.06;
    return [lo - d, hi + d] as const;
  };
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs));
  const [y0, y1] = pad(Math.min(...ys), Math.max(...ys));
  const W = PLOT_WIDTH - m.left - m.right;
  const H = PLOT_HEIGHT - m.top - m.bottom;
  const sx = (x: number) => m.left + ((x - x0) / (x1 - x0)) * W;
  const sy = (y: number) => m.top + H - ((y - y0) / (y1 - y0)) * H;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PLOT_WIDTH, PLOT_HEIGHT);
  ctx.font = "13px Arial, sans-serif";
  ctx.fillStyle = "#222222";
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  for (const t of niceTicks(x0, x1)) {
    ctx.beginPath(); ctx.moveTo(sx(t), m.top); ctx.lineTo(sx(t), m.top + H); ctx.stroke();
    ctx.textAlign = "center"; ctx.fillText(String(t), sx(t), m.top + H + 18);
  }
  for (const t of niceTicks(y0, y1)) {
    ctx.beginPath(); ctx.moveTo(m.left, sy(t)); ctx.lineTo(m.left + W, sy(t)); ctx.stroke();
    ctx.textAlign = "right"; ctx.fillText(String(t), m.left - 8, sy(t) + 4);
  }
  ctx.strokeStyle = "#555555";
  ctx.strokeRect(m.left, m.top, W, H);

  if (series.zeroLine) {
    ctx.strokeStyle = "#333333"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(m.left, sy(0)); ctx.lineTo(m.left + W, sy(0)); ctx.stroke();
  }
  if (series.line) {
    ctx.strokeStyle = "#b65c22"; ctx.lineWidth = 2;
    ctx.beginPath();
    series.line.forEach(([x, y], i) => (i ? ctx!.lineTo(sx(x), sy(y)) : ctx!.moveTo(sx(x), sy(y))));
    ctx.stroke();
  }
  for (const p of series.points) {
    if (p.flagged) {
      ctx.fillStyle = "#c2410c";
      ctx.beginPath();
      ctx.moveTo(sx(p.x), sy(p.y) - 6); ctx.lineTo(sx(p.x) + 6, sy(p.y));
      ctx.lineTo(sx(p.x), sy(p.y) + 6); ctx.lineTo(sx(p.x) - 6, sy(p.y));
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = "#1b7872";
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 4, 0, 2 * Math.PI); ctx.fill();
    }
  }
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.font = "bold 14px Arial, sans-serif";
  ctx.fillText(series.title, PLOT_WIDTH / 2, 22);
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText(series.xLabel, m.left + W / 2, PLOT_HEIGHT - 16);
  ctx.save();
  ctx.translate(18, m.top + H / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(series.yLabel, 0, 0);
  ctx.restore();

  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      resolve(blob ? new Uint8Array(await blob.arrayBuffer()) : null);
    }, "image/png");
  });
}

export function fittedLinePlotPng(result: SimpleRegressionResult) {
  const { x, y, fitted_y } = result.plot_data;
  const flaggedByIndex = residualPoints(result).map((p) => p.flagged);
  return draw({
    title: "Observed values and fitted line",
    xLabel: result.x_variable,
    yLabel: result.y_variable,
    points: x.map((xv, i) => ({ x: xv, y: y[i], flagged: flaggedByIndex[i] })),
    line: x.length ? [[x[0], fitted_y[0]], [x[x.length - 1], fitted_y[fitted_y.length - 1]]] : undefined,
  });
}

export function residualPlotPng(result: SimpleRegressionResult) {
  return draw({
    title: "Residuals versus fitted values",
    xLabel: `Fitted ${result.y_variable}`,
    yLabel: "Residual (observed − fitted)",
    points: residualPoints(result).map((p) => ({ x: p.fitted, y: p.residual, flagged: p.flagged })),
    zeroLine: true,
  });
}
