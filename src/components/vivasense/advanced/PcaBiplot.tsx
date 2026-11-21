import { forwardRef, useId } from "react";
import { biplotTicks, type BiplotGeometry } from "@/lib/pcaBiplot";

/**
 * Equal-unit PCA biplot (Manus PCA audit D07).  One data-to-pixel scale is used for both axes; trait arrows are
 * drawn from the origin; the convention and arrow display factor are printed inside the SVG so that the exported
 * PNG carries them.  Colours are explicit (no CSS variables), so screen and exported PNG render identically.
 */
export const BIPLOT_PLOT_SIZE = 480;
const M = { left: 56, right: 24, top: 20, bottom: 56 };
const WIDTH = M.left + BIPLOT_PLOT_SIZE + M.right;
const CAPTION_CHARS = 92;

const COLORS = { point: "#0A7F5A", arrow: "#B91C1C", axis: "#6B7280", grid: "#E5E7EB", text: "#111827", circle: "#9CA3AF" };

function wrap(text: string, n = CAPTION_CHARS): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    if ((cur + " " + word).trim().length > n) {
      lines.push(cur.trim());
      cur = word;
    } else cur += " " + word;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

export interface PcaBiplotProps {
  geometry: BiplotGeometry;
  varianceExplained: number[];
  title: string;
}

export const PcaBiplot = forwardRef<SVGSVGElement, PcaBiplotProps>(function PcaBiplot({ geometry: g, varianceExplained, title }, ref) {
  const markerId = `pca-arrow-${useId().replace(/:/g, "")}`;
  const px = BIPLOT_PLOT_SIZE / (2 * g.extent);            // identical pixels per data unit on both axes
  const sx = (x: number) => M.left + (x + g.extent) * px;
  const sy = (y: number) => M.top + (g.extent - y) * px;
  const ticks = biplotTicks(g.extent);
  const pctA = varianceExplained[g.a];
  const pctB = varianceExplained[g.b];
  const caption = wrap(
    `${g.description} The plane PC${g.a + 1}–PC${g.b + 1} represents ${(pctA + pctB).toFixed(1)}% of the total variance; ` +
      "positions are a two-dimensional approximation. Signs of components are arbitrary.",
  );
  const height = M.top + BIPLOT_PLOT_SIZE + M.bottom + 18 * (caption.length + 1);
  const xLabel = `PC${g.a + 1} (${pctA.toFixed(1)}%)`;
  const yLabel = `PC${g.b + 1} (${pctB.toFixed(1)}%)`;

  return (
    <svg ref={ref} role="img" aria-label={`${title}. ${g.description}`} viewBox={`0 0 ${WIDTH} ${height}`}
      width="100%" style={{ maxWidth: WIDTH, display: "block" }} xmlns="http://www.w3.org/2000/svg"
      data-testid="pca-biplot-svg" data-px-per-unit-x={px} data-px-per-unit-y={px} data-convention={g.convention}>
      <rect x={0} y={0} width={WIDTH} height={height} fill="#FFFFFF" />
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.arrow} />
        </marker>
        <clipPath id={`${markerId}-clip`}><rect x={M.left} y={M.top} width={BIPLOT_PLOT_SIZE} height={BIPLOT_PLOT_SIZE} /></clipPath>
      </defs>
      <text x={WIDTH / 2} y={14} textAnchor="middle" fontSize={13} fontWeight={600} fill={COLORS.text}>{title}</text>
      {ticks.map((t) => (
        <g key={`t${t}`}>
          <line x1={sx(t)} y1={M.top} x2={sx(t)} y2={M.top + BIPLOT_PLOT_SIZE} stroke={COLORS.grid} />
          <line x1={M.left} y1={sy(t)} x2={M.left + BIPLOT_PLOT_SIZE} y2={sy(t)} stroke={COLORS.grid} />
          <text x={sx(t)} y={M.top + BIPLOT_PLOT_SIZE + 16} textAnchor="middle" fontSize={11} fill={COLORS.axis}>{t}</text>
          <text x={M.left - 6} y={sy(t) + 4} textAnchor="end" fontSize={11} fill={COLORS.axis}>{t}</text>
        </g>
      ))}
      <rect x={M.left} y={M.top} width={BIPLOT_PLOT_SIZE} height={BIPLOT_PLOT_SIZE} fill="none" stroke={COLORS.axis} />
      <line data-testid="pca-biplot-axis-x" x1={M.left} y1={sy(0)} x2={M.left + BIPLOT_PLOT_SIZE} y2={sy(0)} stroke={COLORS.axis} strokeDasharray="4 3" />
      <line data-testid="pca-biplot-axis-y" x1={sx(0)} y1={M.top} x2={sx(0)} y2={M.top + BIPLOT_PLOT_SIZE} stroke={COLORS.axis} strokeDasharray="4 3" />
      <text x={M.left + BIPLOT_PLOT_SIZE / 2} y={M.top + BIPLOT_PLOT_SIZE + 36} textAnchor="middle" fontSize={12} fill={COLORS.text}>{xLabel}</text>
      <text x={16} y={M.top + BIPLOT_PLOT_SIZE / 2} textAnchor="middle" fontSize={12} fill={COLORS.text}
        transform={`rotate(-90 16 ${M.top + BIPLOT_PLOT_SIZE / 2})`}>{yLabel}</text>
      <g clipPath={`url(#${markerId}-clip)`}>
        {g.unitCircleRadius != null && (
          <circle data-testid="pca-biplot-unit-circle" cx={sx(0)} cy={sy(0)} r={g.unitCircleRadius * px}
            fill="none" stroke={COLORS.circle} strokeDasharray="5 4" />
        )}
        {g.points.map((p) => (
          <g key={`p-${p.genotype}`} data-testid="pca-biplot-point" data-genotype={p.genotype} data-x={p.x} data-y={p.y}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={4} fill={COLORS.point} />
            <text x={sx(p.x)} y={sy(p.y) - 7} textAnchor="middle" fontSize={10} fill={COLORS.text}>{p.genotype}</text>
          </g>
        ))}
        {g.vectors.map((v) => (
          <g key={`v-${v.trait}`} data-testid="pca-biplot-vector" data-trait={v.trait} data-raw-x={v.rawX} data-raw-y={v.rawY}>
            <line x1={sx(0)} y1={sy(0)} x2={sx(v.x)} y2={sy(v.y)} stroke={COLORS.arrow} strokeWidth={1.8} markerEnd={`url(#${markerId})`} />
            <text x={sx(v.x) + (v.x >= 0 ? 6 : -6)} y={sy(v.y) + (v.y >= 0 ? -6 : 14)} textAnchor={v.x >= 0 ? "start" : "end"}
              fontSize={11} fontWeight={600} fill={COLORS.arrow}>{v.trait}</text>
          </g>
        ))}
      </g>
      {caption.map((line, i) => (
        <text key={i} data-testid="pca-biplot-caption" x={M.left - 40} y={M.top + BIPLOT_PLOT_SIZE + 60 + 18 * i} fontSize={11} fill={COLORS.text}>{line}</text>
      ))}
    </svg>
  );
});
