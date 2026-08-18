/**
 * Real backend responses, captured by running the live
 * POST /crop-protection/bioassay/analyze handler against the backend's own
 * fixtures in genetics-module/testdata/crop_protection/.
 *
 *   dorcas — 3 treatments x 5 doses x 3 reps, control separated, factorial CRD
 *   alcl   — AL + CL -> ALCL joint action (positive but inconclusive at 48 h)
 *   clb    — CL + B -> CLB joint action (antagonism at 24 h, repeated controls)
 *
 * Tests assert against these rather than hand-written objects, so a contract
 * drift on the backend surfaces here instead of in production.
 */
import alclJson from "./alcl.json";
import clbJson from "./clb.json";
import dorcasJson from "./dorcas.json";
import type {
  BioassayAnalysisResponse,
  BioassayResponseDefinition,
} from "@/types/cropProtection";

export const dorcasResult = dorcasJson as unknown as BioassayAnalysisResponse;
export const alclResult = alclJson as unknown as BioassayAnalysisResponse;
export const clbResult = clbJson as unknown as BioassayAnalysisResponse;

/** The response definitions submitted alongside each captured run. */
export const dorcasDefinitions: BioassayResponseDefinition[] = [
  {
    id: "mortality_72h",
    type: "mortality",
    raw_column: "Mort72_pct",
    inference_column: "AdtM72",
    observation_time: 72,
    time_unit: "h",
    abbott_correction: true,
    cumulative: true,
  },
  {
    id: "mortality_48h",
    type: "mortality",
    raw_column: "Mort48_pct",
    inference_column: "AdtM48",
    observation_time: 48,
    time_unit: "h",
    abbott_correction: true,
    cumulative: true,
  },
  {
    id: "adult_emergence_21d",
    type: "count",
    raw_column: "Adtem21_raw",
    inference_column: "Adtem21_raw",
    observation_time: 21,
    time_unit: "d",
  },
  {
    id: "weight_loss",
    type: "continuous",
    raw_column: "WTL",
    inference_column: "WTL",
  },
];

export const alclDefinitions: BioassayResponseDefinition[] = [
  {
    id: "mortality_48h",
    type: "mortality",
    raw_column: "Mort48_raw",
    inference_column: "TAdTmRT48",
    observation_time: 48,
    time_unit: "h",
    abbott_correction: true,
    cumulative: true,
  },
];

export const clbDefinitions: BioassayResponseDefinition[] = [
  {
    id: "mortality_24h",
    type: "mortality",
    raw_column: "Mort24 %",
    inference_column: "AdtM24",
    observation_time: 24,
    time_unit: "h",
    abbott_correction: true,
    cumulative: true,
  },
];
