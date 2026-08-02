/**
 * Workspace V3 — footer metrics. Research-weighted left, performance de-emphasized
 * right. Per product decision (Q4): publication-ready = analyses with status
 * 'success' (all, today), pending = the remainder (0 today). Avg runtime is the
 * mean of real execution_time_ms values; hidden when none are recorded.
 */
interface Props {
  publicationReady: number;
  pending: number;
  studyCount: number;
  avgRuntimeMs: number | null;
}

function avg(ms: number | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

export function WorkspaceFooterMetrics({ publicationReady, pending, studyCount, avgRuntimeMs }: Props) {
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
