/**
 * Bioassay / Efficacy Analysis workflow.
 *
 *   upload → map roles → confirm design → select responses → configure
 *   mortality/control → optional co-toxicity → run → review warnings → results
 *
 * Request failures and scientific warnings are kept apart: a failure blocks the
 * run and is explained in researcher wording, while backend warnings travel with
 * a successful result and are rendered before any inferential section.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, FlaskConical, Loader2, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeBioassay, SupersededAnalysisError } from "@/services/cropProtectionApi";
import { BioassayOptionsPanel, type ControlState, type CotoxicityState } from "./BioassayOptions";
import { BioassayResponseMapping } from "./BioassayResponseMapping";
import { emptyDraft } from "./drafts";
import { BioassayResults } from "./BioassayResults";
import { BioassayRoleMapping, type RoleMappingState } from "./BioassayRoleMapping";
import { BioassayUpload, type BioassayDatasetState } from "./BioassayUpload";
import type {
  BioassayAnalysisRequest,
  BioassayAnalysisResponse,
  BioassayResponseDefinition,
  ResponseDraft,
} from "@/types/cropProtection";

const ALPHA = 0.05;

function parseDoseSeries(text: string): number[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number);
}

export function BioassayPanel() {
  const { toast } = useToast();

  const [dataset, setDataset] = useState<BioassayDatasetState | null>(null);
  const [roles, setRoles] = useState<RoleMappingState>({
    treatmentColumn: "",
    doseColumn: "",
    replicateColumn: "",
    controlLevel: "",
    doseSeriesText: "",
  });
  const [drafts, setDrafts] = useState<ResponseDraft[]>([emptyDraft(0)]);
  const [control, setControl] = useState<ControlState>({
    policy: "require_unique",
    highControlMortalityThreshold: "",
  });
  const [cotoxicity, setCotoxicity] = useState<CotoxicityState>({
    enabled: false,
    componentA: "",
    componentB: "",
    mixture: "",
    responseKeys: [],
  });

  const [isRunning, setIsRunning] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [results, setResults] = useState<BioassayAnalysisResponse | null>(null);
  const [submitted, setSubmitted] = useState<BioassayResponseDefinition[]>([]);

  // Treatment values visible in the preview rows, offered as control-level hints.
  const controlSuggestions = useMemo(() => {
    if (!dataset || !roles.treatmentColumn) return [];
    const seen = dataset.preview
      .map((row) => row[roles.treatmentColumn])
      .filter((value) => value !== null && value !== undefined)
      .map(String);
    return Array.from(new Set(seen));
  }, [dataset, roles.treatmentColumn]);

  const eligibleCotoxResponses = drafts.filter(
    (draft) => draft.type === "mortality" && draft.abbottCorrection && draft.id.trim()
  );

  const validation = (() => {
    if (!dataset) return "Upload a dataset to begin.";
    if (!roles.treatmentColumn) return "Select the Treatment column.";
    if (!roles.doseColumn) return "Select the Dose / Concentration column.";
    if (!roles.replicateColumn) return "Select the Replicate column.";
    if (!roles.controlLevel.trim()) return "Enter the control treatment level.";

    const doses = parseDoseSeries(roles.doseSeriesText);
    if (doses.length === 0) return "Confirm the expected dose levels.";
    if (doses.some((dose) => !Number.isFinite(dose))) {
      return "Expected dose levels must be numbers separated by commas.";
    }
    if (new Set(doses).size !== doses.length) return "Expected dose levels must be unique.";

    if (drafts.length === 0) return "Add at least one response.";
    for (const draft of drafts) {
      if (!draft.id.trim()) return "Every response needs a name.";
      if (!draft.rawColumn) return `Select the raw/display column for "${draft.id}".`;
      if (!draft.inferenceColumn) return `Select the inference column for "${draft.id}".`;
      if (draft.type === "mortality") {
        if (!draft.observationTime.trim() || !Number.isFinite(Number(draft.observationTime))) {
          return `Mortality response "${draft.id}" needs a numeric observation time.`;
        }
        if (!draft.timeUnit.trim()) {
          return `Mortality response "${draft.id}" needs a time unit.`;
        }
      }
    }
    const ids = drafts.map((d) => d.id.trim());
    if (new Set(ids).size !== ids.length) return "Response names must be unique.";

    if (cotoxicity.enabled) {
      if (!cotoxicity.componentA.trim()) return "Select Component A for joint action.";
      if (!cotoxicity.componentB.trim()) return "Select Component B for joint action.";
      if (!cotoxicity.mixture.trim()) return "Select the Mixture level for joint action.";
      if (cotoxicity.responseKeys.length === 0) {
        return "Select at least one mortality response for joint action.";
      }
    }
    return null;
  })();

  const buildRequest = (): BioassayAnalysisRequest => {
    const responses: BioassayResponseDefinition[] = drafts.map((draft) => ({
      id: draft.id.trim(),
      type: draft.type,
      raw_column: draft.rawColumn,
      inference_column: draft.inferenceColumn,
      observation_time: draft.observationTime.trim()
        ? Number(draft.observationTime)
        : null,
      time_unit: draft.timeUnit.trim() || null,
      abbott_correction: draft.type === "mortality" ? draft.abbottCorrection : false,
      cumulative: draft.type === "mortality" ? draft.cumulative : false,
    }));

    const keyToId = new Map(drafts.map((d) => [d.key, d.id.trim()]));
    const threshold = control.highControlMortalityThreshold.trim();

    return {
      dataset: {
        base64_content: dataset!.base64Content,
        file_type: dataset!.fileType,
      },
      design: {
        design_type: "crd",
        treatment_column: roles.treatmentColumn,
        dose_column: roles.doseColumn,
        replicate_column: roles.replicateColumn,
        control_treatment_level: roles.controlLevel.trim(),
        expected_dose_series: parseDoseSeries(roles.doseSeriesText),
      },
      responses,
      cotoxicity: cotoxicity.enabled
        ? {
            enabled: true,
            method: "bliss",
            component_a_level: cotoxicity.componentA.trim(),
            component_b_level: cotoxicity.componentB.trim(),
            mixture_level: cotoxicity.mixture.trim(),
            response_ids: cotoxicity.responseKeys
              .map((key) => keyToId.get(key) ?? "")
              .filter(Boolean),
          }
        : null,
      // Every declared response participates in the descriptive summaries; the
      // backend skips pairs and treatments it cannot fit.
      correlation_response_ids: responses.length > 1 ? responses.map((r) => r.id) : [],
      regression_response_ids: responses.map((r) => r.id),
      options: {
        alpha: ALPHA,
        floor_abbott_at_zero: true,
        control_policy: control.policy,
        high_control_mortality_warning_threshold:
          threshold && Number.isFinite(Number(threshold)) ? Number(threshold) : null,
      },
    };
  };

  const handleRun = async () => {
    if (validation || isRunning) return;
    setIsRunning(true);
    setRequestError(null);
    setResults(null);

    const request = buildRequest();
    try {
      const response = await analyzeBioassay(request);
      setResults(response);
      setSubmitted(request.responses);
      toast({
        title: "Bioassay analysis complete",
        description: `${response.response_results.length} response(s) analysed · ${response.warnings.length} data-quality alert(s).`,
      });
    } catch (error) {
      if (error instanceof SupersededAnalysisError) return;
      const message = error instanceof Error ? error.message : String(error);
      setRequestError(message);
      toast({ title: "Analysis failed", description: message, variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <BioassayUpload dataset={dataset} onDatasetReady={setDataset} />

      {dataset && (
        <>
          <BioassayRoleMapping
            columns={dataset.columns}
            controlSuggestions={controlSuggestions}
            value={roles}
            onChange={setRoles}
          />

          <BioassayResponseMapping
            columns={dataset.columns}
            drafts={drafts}
            onChange={setDrafts}
          />

          <BioassayOptionsPanel
            control={control}
            onControlChange={setControl}
            cotoxicity={cotoxicity}
            onCotoxicityChange={setCotoxicity}
            eligibleResponses={eligibleCotoxResponses}
          />

          {validation && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> {validation}
            </div>
          )}

          <Button onClick={handleRun} disabled={isRunning || !!validation} className="gap-2">
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? "Analysing…" : "Run Analysis"}
          </Button>
        </>
      )}

      {requestError && (
        <Card className="border-destructive/40">
          <CardContent className="space-y-1 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="h-4 w-4" /> The analysis did not run
            </p>
            <p className="text-sm text-muted-foreground">{requestError}</p>
          </CardContent>
        </Card>
      )}

      {isRunning && !results && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Running the factorial CRD analysis for each response…
          </CardContent>
        </Card>
      )}

      {results && (
        <BioassayResults results={results} definitions={submitted} alpha={ALPHA} />
      )}

      {!dataset && !results && (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-16 text-center">
            <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-muted-foreground">
              Upload a bioassay dataset to begin.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
