/**
 * Collapsible provenance panel.
 *
 * Everything the backend recorded about how a number was produced — which
 * column carried inference, which carried display, how many rows entered the
 * factorial model, which rows were excluded as control, the alpha, the engine,
 * and the Abbott/Bliss/bootstrap settings. This is what a later reproducible
 * export will be built from, so nothing is summarised away.
 */
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import type { BioassayAnalysisResponse } from "@/types/cropProtection";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(9rem,14rem)_1fr] gap-3 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="break-words font-medium">{value}</span>
    </div>
  );
}

export function AnalysisDetailsPanel({ results }: { results: BioassayAnalysisResponse }) {
  const cotoxProvenance = results.cotoxicity?.provenance as
    | Record<string, unknown>
    | undefined;

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ChevronDown className="h-4 w-4" />
          Analysis Details
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-5 rounded-md border bg-muted/20 p-4">
        <div>
          <p className="mb-1 text-sm font-semibold">Run</p>
          <Row label="Contract" value={String(results.provenance.request_contract ?? "—")} />
          <Row
            label="Statistical services"
            value={
              Array.isArray(results.provenance.statistical_services)
                ? (results.provenance.statistical_services as string[]).join(", ")
                : "—"
            }
          />
          <Row label="Design" value={results.design.design_type} />
          <Row label="Replicate role" value={results.design.replicate_role.replace(/_/g, " ")} />
          <Row
            label="Control rows used"
            value={results.design.control_rows_used.join(", ") || "—"}
          />
        </div>

        {results.response_results.map((response) => (
          <div key={response.response_id}>
            <p className="mb-1 text-sm font-semibold">{response.response_id}</p>
            <Row label="Biological type" value={response.provenance.biological_type} />
            <Row label="Raw column" value={response.provenance.raw_column} />
            <Row label="Inference column" value={response.provenance.inference_column} />
            <Row label="Display column" value={response.provenance.display_column} />
            <Row label="Transformation" value={response.provenance.transformation} />
            <Row label="Abbott applied" value={response.provenance.abbott_applied ? "Yes" : "No"} />
            <Row
              label="Factorial rows used"
              value={`${response.provenance.factorial_rows_used.length} rows`}
            />
            <Row
              label="Excluded rows (control)"
              value={`${response.provenance.excluded_rows.length} rows — indices ${
                response.provenance.excluded_rows.join(", ") || "—"
              }`}
            />
            <Row label="Alpha" value={String(response.provenance.alpha)} />
            <Row label="Software engine" value={response.provenance.software_engine} />
            {response.mortality_correction && (
              <>
                <Row
                  label="Abbott control policy"
                  value={response.mortality_correction.control_policy.replace(/_/g, " ")}
                />
                <Row
                  label="Abbott control n"
                  value={`${response.mortality_correction.control_n} (${response.mortality_correction.duplicates_removed} duplicate row(s) removed)`}
                />
                <Row
                  label="Abbott verification"
                  value={response.mortality_correction.verification.verification_status.replace(
                    /_/g, " "
                  )}
                />
              </>
            )}
          </div>
        ))}

        {cotoxProvenance && (
          <div>
            <p className="mb-1 text-sm font-semibold">Joint action</p>
            <Row label="Expected model" value={String(cotoxProvenance.expected_model ?? "—")} />
            <Row label="Input scale" value={String(cotoxProvenance.input_scale ?? "—")} />
            <Row label="Bootstrap" value={String(cotoxProvenance.bootstrap ?? "—")} />
            <Row
              label="Bootstrap iterations"
              value={String(cotoxProvenance.bootstrap_iterations ?? "—")}
            />
            <Row label="Confidence level" value={String(cotoxProvenance.confidence_level ?? "—")} />
            <Row label="Seed" value={String(cotoxProvenance.seed ?? "not fixed")} />
            <Row
              label="Ceiling threshold"
              value={String(cotoxProvenance.ceiling_threshold ?? "—")}
            />
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
