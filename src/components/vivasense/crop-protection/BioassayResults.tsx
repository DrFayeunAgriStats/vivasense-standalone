/**
 * Bioassay results, rendered in the backend's scientific order:
 *
 *   design → data-quality alerts → ANOVA → mean separation → interaction plot
 *   → Abbott mortality → co-toxicity → dose-response → correlation → diagnostics
 *
 * Mean separation follows interpretation_priority: when the interaction is
 * significant the Treatment × Dose matrix leads and marginal means are demoted;
 * otherwise marginal means take the front.
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AbbottMortalityTable } from "./AbbottMortalityTable";
import { AnalysisDetailsPanel } from "./AnalysisDetailsPanel";
import { AnovaResultsTable } from "./AnovaResultsTable";
import { BioassayAlerts } from "./BioassayAlerts";
import { CorrelationResults } from "./CorrelationResults";
import { CotoxicityResults } from "./CotoxicityResults";
import { DiagnosticsResults } from "./DiagnosticsResults";
import { DoseResponseTable } from "./DoseResponseTable";
import { InteractionMeansTable } from "./InteractionMeansTable";
import { InteractionPlot } from "./InteractionPlot";
import { MarginalMeansTable } from "./MarginalMeansTable";
import type {
  BioassayAnalysisResponse,
  BioassayResponseDefinition,
  BioassayResponseResult,
} from "@/types/cropProtection";

function Section({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ResponseBlock({
  result,
  definition,
  alpha,
}: {
  result: BioassayResponseResult;
  definition?: BioassayResponseDefinition;
  alpha: number;
}) {
  const scalesDiffer =
    result.provenance.inference_column !== result.provenance.display_column;
  const scaleNote = scalesDiffer
    ? {
        inferenceColumn: result.provenance.inference_column,
        displayColumn: result.provenance.display_column,
      }
    : null;
  const interactionFirst =
    result.interpretation_metadata.interpretation_priority !== "main_effects";

  const timeLabel =
    definition?.observation_time === null || definition?.observation_time === undefined
      ? ""
      : ` · ${definition.observation_time}${definition.time_unit ? ` ${definition.time_unit}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">{result.response_id}</h3>
        <Badge variant="outline">{result.biological_type}{timeLabel}</Badge>
        {scalesDiffer && (
          <Badge variant="secondary" className="font-normal">
            Inference: {result.provenance.inference_column} · Display:{" "}
            {result.provenance.display_column}
          </Badge>
        )}
      </div>

      {scalesDiffer && (
        <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          ANOVA and Tukey grouping use the declared inference variable
          (<span className="font-medium text-foreground">{result.provenance.inference_column}</span>);
          displayed means stay on the biological/raw scale
          (<span className="font-medium text-foreground">{result.provenance.display_column}</span>).
        </p>
      )}

      <Section title="ANOVA">
        <AnovaResultsTable rows={result.anova} alpha={alpha} />
      </Section>

      <Section title="Mean Separation">
        {interactionFirst ? (
          <div className="space-y-8">
            <InteractionMeansTable means={result.interaction.means} scaleNote={scaleNote} />
            <MarginalMeansTable
              treatmentMeans={result.treatment_marginal_means}
              doseMeans={result.dose_marginal_means}
              interactionSignificant
            />
          </div>
        ) : (
          <div className="space-y-8">
            <MarginalMeansTable
              treatmentMeans={result.treatment_marginal_means}
              doseMeans={result.dose_marginal_means}
              interactionSignificant={false}
            />
            <InteractionMeansTable means={result.interaction.means} scaleNote={scaleNote} />
          </div>
        )}
      </Section>

      {(result.cell_means ?? result.interaction.means)[0]?.factor_levels &&
       Object.keys((result.cell_means ?? result.interaction.means)[0].factor_levels!).length === 1 ? null : <Section title="Interaction Plot">
        <InteractionPlot
          means={result.cell_means ?? result.interaction.means}
          responseLabel={result.response_id}
          displayColumn={result.provenance.display_column}
        />
      </Section>}

      {result.mortality_correction?.abbott_applied && (
        <Section
          title="Abbott-corrected mortality"
          subtitle="Corrected against the untreated control at the same observation time."
        >
          <AbbottMortalityTable
            correction={result.mortality_correction}
            observationTime={definition?.observation_time ?? null}
            timeUnit={definition?.time_unit ?? null}
          />
        </Section>
      )}

      <Section title="Diagnostics">
        <DiagnosticsResults
          diagnostics={result.diagnostics}
          warnings={result.mortality_correction?.warnings ?? []}
        />
      </Section>
    </div>
  );
}

interface Props {
  results: BioassayAnalysisResponse;
  /** The submitted definitions, used only for observation-time labels. */
  definitions: BioassayResponseDefinition[];
  alpha: number;
}

export function BioassayResults({ results, definitions, alpha }: Props) {
  const design = results.design;
  const definitionById = new Map(definitions.map((d) => [d.id, d]));

  return (
    <div className="space-y-6">
      {/* 1 — Study design */}
      <Section title="Study Design">
        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><span className="text-muted-foreground">Design:</span> Factorial CRD</div>
          <div>
            <span className="text-muted-foreground">Experimental factors:</span>{" "}
            {design.factor_count ?? design.factors?.length ?? 2}
          </div>
          <div><span className="text-muted-foreground">Factorial cells:</span> {design.cells}</div>
          {!design.factors && <>
            <div><span className="text-muted-foreground">Treatments:</span> {design.factorial_treatments.length}</div>
            <div><span className="text-muted-foreground">Doses:</span> {design.dose_levels.length}</div>
            <div className="sm:col-span-2"><span className="text-muted-foreground">Treatments:</span> {design.factorial_treatments.join(", ")}</div>
          </>}
          <div>
            <span className="text-muted-foreground">Factorial observations:</span>{" "}
            {design.factorial_rows}
          </div>
          <div>
            <span className="text-muted-foreground">Control observations:</span>{" "}
            {design.control_rows}
          </div>
          <div>
            <span className="text-muted-foreground">Replicates per cell:</span>{" "}
            {design.cell_replication ?? "unequal"}
          </div>
          <div>
            <span className="text-muted-foreground">Balanced:</span>{" "}
            {design.balanced ? "Yes" : "No"}
          </div>
          {design.factors?.map(factor => <div key={factor.column}><span className="text-muted-foreground">{factor.display_name}:</span> {factor.levels} levels</div>)}
        </div>
      </Section>

      {/* 2 — Data quality alerts, before any inferential result */}
      <BioassayAlerts
        warnings={results.warnings}
        cumulativeDecreases={results.cumulative_mortality_validation?.decreases ?? []}
      />

      {/* 3–6, 10 — per response */}
      {results.response_results.map((result) => (
        <ResponseBlock
          key={result.response_id}
          result={result}
          definition={definitionById.get(result.response_id)}
          alpha={alpha}
        />
      ))}

      {/* 7 — Co-toxicity */}
      {results.cotoxicity && (
        <Section title="Joint Action / Co-toxicity">
          <CotoxicityResults result={results.cotoxicity} />
        </Section>
      )}

      {/* 8 — Dose-response regression */}
      {results.regression.length > 0 && (
        <Section title="Dose-response regression">
          <DoseResponseTable rows={results.regression} />
        </Section>
      )}

      {/* 9 — Correlation */}
      {results.correlation.length > 0 && (
        <Section title="Correlation">
          <CorrelationResults rows={results.correlation} />
        </Section>
      )}

      <AnalysisDetailsPanel results={results} />
    </div>
  );
}
