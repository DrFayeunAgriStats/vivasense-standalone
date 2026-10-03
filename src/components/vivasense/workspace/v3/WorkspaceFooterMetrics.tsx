/**
 * Workspace V3 — footer metrics. Research-weighted left, performance de-emphasized
 * right. publication-ready = successful analyses that are NOT Preview
 * (session-only) — a Preview Factorial / Split-Plot analysis is never counted
 * as ready and is shown as its own "preview" figure instead. pending = analyses
 * that did not succeed. Avg runtime is the mean of real execution_time_ms
 * values; hidden when none are recorded.
 */
interface Props {
  publicationReady: number;
  /** Successful analyses of Preview (session-only) designs. Hidden when 0. */
  previewCount?: number;
  pending: number;
  studyCount: number;
  avgRuntimeMs: number | null;
}

function avg(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

export function WorkspaceFooterMetrics({ publicationReady, previewCount = 0, pending, studyCount, avgRuntimeMs }: Props) {
  const rt = avg(avgRuntimeMs);
  const Item = ({ v, l, accent }: { v: string; l: string; accent?: boolean }) => (
    <div className="flex items-baseline gap-1 px-1.5 text-[11px] text-muted-foreground">
      <span className={`font-mono text-[13px] font-bold ${accent ? "text-primary" : "text-foreground/80"}`}>{v}</span>
      {l}
    </div>
  );
  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5 border-t border-border pt-4">
      <Item v={String(publicationReady)} l="publication-ready" accent />
      {previewCount > 0 && <Item v={String(previewCount)} l="preview (session-only)" />}
      <Item v={String(pending)} l="pending" />
      <Item v={String(studyCount)} l={studyCount === 1 ? "study" : "studies"} />
      {rt && (
        <>
          <span className="mx-2 h-4 w-px self-center bg-border" aria-hidden />
          <div className="flex items-baseline gap-1 px-1.5 text-[11px] text-muted-foreground">
            <span className="font-mono text-[12px] font-bold text-muted-foreground">{rt}</span>
            avg results
          </div>
        </>
      )}
    </div>
  );
}
