import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PathDiagramData } from "@/types/advancedAnalysis";

interface Props {
  data?: PathDiagramData & { residual_path?: number };
  outcomeTrait?: string;
}

function truncate(s: string, n = 15) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const GREEN = "#0A7F5A";
const GREY = "#9CA3AF";
const RESIDUAL = "#6B7280";

export function PathDiagramSVG({ data, outcomeTrait }: Props) {
  const edges = Array.isArray(data?.edges) ? data!.edges! : [];
  const nodes = Array.isArray(data?.nodes) ? data!.nodes! : [];
  const residualPath =
    (data as Record<string, unknown> | undefined)?.residual_path as number | undefined;

  // Determine outcome label
  const outcomeNode = nodes.find((n) => n.type === "outcome");
  const outcomeLabel =
    outcomeNode?.label ?? outcomeNode?.id ?? outcomeTrait ?? "Outcome";

  // Predictor edges (those whose target is the outcome node id or outcome label)
  const outcomeId = outcomeNode?.id ?? outcomeTrait ?? outcomeLabel;
  const predictorEdges = edges.filter(
    (e) => (e.target === outcomeId || e.target === outcomeLabel) && e.source !== "e"
  );

  if (predictorEdges.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Path diagram data is not available.
        </CardContent>
      </Card>
    );
  }

  const W = 760;
  const padding = 50;
  const rowH = 64;
  const H = Math.max(280, predictorEdges.length * rowH + padding * 2);
  const leftBoxW = 170;
  const leftX = 20;
  const leftRightEdge = leftX + leftBoxW;
  const rightBoxW = 170;
  const rightX = W - rightBoxW - 30;
  const cy = H / 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg">Path diagram</CardTitle>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          <defs>
            <marker id="pd-arrow-green" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill={GREEN} />
            </marker>
            <marker id="pd-arrow-grey" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill={GREY} />
            </marker>
            <marker id="pd-arrow-residual" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill={RESIDUAL} />
            </marker>
          </defs>

          {predictorEdges.map((edge, i) => {
            const denom = Math.max(1, predictorEdges.length - 1);
            const y =
              predictorEdges.length === 1
                ? cy
                : padding + i * ((H - padding * 2) / denom);
            const sig = !!edge.significant;
            const stroke = sig ? GREEN : GREY;
            const dash = sig ? undefined : "6 5";
            const marker = sig ? "url(#pd-arrow-green)" : "url(#pd-arrow-grey)";
            const label = (Number(edge.weight) || 0).toFixed(3);
            const sourceLabel = truncate(String(edge.source ?? ""), 15);
            return (
              <g key={`${edge.source}-${i}`}>
                <rect
                  x={leftX}
                  y={y - 20}
                  width={leftBoxW}
                  height={40}
                  rx={8}
                  fill="#F9FAFB"
                  stroke="#E5E7EB"
                />
                <text
                  x={leftX + leftBoxW / 2}
                  y={y + 5}
                  textAnchor="middle"
                  fontSize="13"
                  fill="#111827"
                >
                  {sourceLabel}
                </text>
                <line
                  x1={leftRightEdge}
                  y1={y}
                  x2={rightX}
                  y2={cy}
                  stroke={stroke}
                  strokeWidth={sig ? 2.25 : 1.5}
                  strokeDasharray={dash}
                  markerEnd={marker}
                />
                <text
                  x={(leftRightEdge + rightX) / 2}
                  y={(y + cy) / 2 - 6}
                  fontSize="11"
                  fontWeight={sig ? 600 : 400}
                  fill={stroke}
                  textAnchor="middle"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Outcome node */}
          <rect
            x={rightX}
            y={cy - 24}
            width={rightBoxW}
            height={48}
            rx={10}
            fill={`${GREEN}1A`}
            stroke={GREEN}
            strokeWidth={1.5}
          />
          <text
            x={rightX + rightBoxW / 2}
            y={cy + 6}
            textAnchor="middle"
            fontSize="14"
            fontWeight={600}
            fill={GREEN}
          >
            {truncate(String(outcomeLabel), 15)}
          </text>

          {/* Residual error node */}
          {typeof residualPath === "number" && Number.isFinite(residualPath) && (
            <g>
              <circle
                cx={rightX + rightBoxW / 2}
                cy={24}
                r={16}
                fill="#F3F4F6"
                stroke={RESIDUAL}
              />
              <text
                x={rightX + rightBoxW / 2}
                y={29}
                textAnchor="middle"
                fontSize="13"
                fontStyle="italic"
                fill={RESIDUAL}
              >
                e
              </text>
              <line
                x1={rightX + rightBoxW / 2}
                y1={40}
                x2={rightX + rightBoxW / 2}
                y2={cy - 24}
                stroke={RESIDUAL}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                markerEnd="url(#pd-arrow-residual)"
              />
              <text
                x={rightX + rightBoxW / 2 + 8}
                y={(40 + cy - 24) / 2}
                fontSize="11"
                fill={RESIDUAL}
              >
                {residualPath.toFixed(3)}
              </text>
            </g>
          )}
        </svg>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-6" style={{ background: GREEN }} />
            Significant direct effect
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-6"
              style={{
                backgroundImage: `linear-gradient(to right, ${GREY} 50%, transparent 0%)`,
                backgroundSize: "6px 1px",
                backgroundRepeat: "repeat-x",
              }}
            />
            Non-significant
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-6"
              style={{
                backgroundImage: `linear-gradient(to right, ${RESIDUAL} 50%, transparent 0%)`,
                backgroundSize: "5px 1px",
                backgroundRepeat: "repeat-x",
              }}
            />
            Residual path (e)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
