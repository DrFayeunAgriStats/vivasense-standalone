/**
 * REL-UI-01: Research Workspace overview entry for General Correlation.
 *
 * Visible at every screen size (the desktop sidebar is hidden on phones and
 * small tablets). Ordinary Pearson/Spearman correlation between measured
 * variables — explicitly not genetic correlation.
 */
import { Link } from "react-router-dom";
import { ArrowRight, Sigma } from "lucide-react";

export const GENERAL_CORRELATION_PATH = "/relationship-analysis/general";

export function GeneralCorrelationCard() {
  return (
    <section
      aria-labelledby="general-correlation-card-title"
      className="rounded-lg border border-border bg-card p-4"
      data-testid="workspace-general-correlation"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Sigma className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h2 id="general-correlation-card-title" className="text-[14px] font-semibold text-foreground">
              General Correlation
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Ordinary Pearson or Spearman correlation between measured variables.{" "}
              <strong className="font-medium text-foreground">Not genetic correlation</strong> — no genotype,
              replication or design information is used.
            </p>
          </div>
        </div>
        <Link
          to={GENERAL_CORRELATION_PATH}
          className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted sm:w-auto sm:shrink-0"
          data-testid="workspace-general-correlation-open"
        >
          Open General Correlation
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export default GeneralCorrelationCard;
