/**
 * Governed ANOVA v1 design vocabulary, column requirements and structural
 * preview — kept as pure functions so the rules are testable without mounting
 * the panel.
 *
 * Phase B replaces the old four-tab vocabulary (crd | rcbd | factorial |
 * split_plot_rcbd) with the five governed designs. The single collapsed
 * "Factorial" tab was the visible face of the FAC-1 defect: it emitted the
 * legacy `factorial` identifier, which does not reach the governed two-factor
 * path, and it required a replication column for every factorial — so a
 * genuinely completely-randomised factorial had nowhere to go.
 */

import type {
  AnovaAlpha,
  GovernedDesignType,
  UploadAnalysisRequest,
} from "@/services/geneticsUploadApi";

export type { GovernedDesignType };

/** Roles a dataset column can be mapped to. */
export type ColumnRole =
  | "treatment"
  | "rep"
  | "factor_a"
  | "factor_b"
  | "main_plot"
  | "sub_plot";

export interface DesignMeta {
  id: GovernedDesignType;
  /** Short tab label. */
  label: string;
  /** Full user-facing name. */
  fullLabel: string;
  hint: string;
  /** Roles that must be mapped before analysis can run. */
  requiredRoles: ColumnRole[];
}

export const ROLE_LABELS: Record<ColumnRole, string> = {
  treatment: "Treatment / Factor",
  rep: "Replication / Block",
  factor_a: "Factor A",
  factor_b: "Factor B",
  main_plot: "Whole-plot factor",
  sub_plot: "Subplot factor",
};

export const GOVERNED_DESIGNS: DesignMeta[] = [
  {
    id: "crd",
    label: "CRD",
    fullLabel: "Completely Randomized Design (CRD)",
    hint: "One treatment factor, complete randomisation, no blocking.",
    requiredRoles: ["treatment"],
  },
  {
    id: "rcbd",
    label: "RCBD",
    fullLabel: "Randomized Complete Block Design (RCBD)",
    hint: "One treatment factor arranged in complete replication blocks.",
    requiredRoles: ["treatment", "rep"],
  },
  {
    id: "factorial_crd",
    label: "Factorial CRD",
    fullLabel: "Factorial CRD",
    hint:
      "Two crossed treatment factors (A × B), completely randomised. Analysed as A*B — no blocking term.",
    requiredRoles: ["factor_a", "factor_b"],
  },
  {
    id: "factorial_rcbd",
    label: "Factorial RCBD",
    fullLabel: "Factorial RCBD",
    hint:
      "Two crossed treatment factors (A × B) within complete replication blocks. Analysed as block + A*B.",
    requiredRoles: ["factor_a", "factor_b", "rep"],
  },
  {
    id: "split_plot_rcbd",
    label: "Split-Plot RCBD",
    fullLabel: "Split-Plot RCBD",
    hint:
      "Restricted randomisation: a whole-plot factor within replication blocks, and a subplot factor within each whole plot.",
    requiredRoles: ["rep", "main_plot", "sub_plot"],
  },
];

export const GOVERNED_DESIGN_IDS: GovernedDesignType[] = GOVERNED_DESIGNS.map((d) => d.id);

export function designMeta(design: GovernedDesignType): DesignMeta {
  const meta = GOVERNED_DESIGNS.find((d) => d.id === design);
  if (!meta) throw new Error(`Unknown governed design: ${design}`);
  return meta;
}

export function requiredRoles(design: GovernedDesignType): ColumnRole[] {
  return designMeta(design).requiredRoles;
}

/**
 * Whether a replication / block column is part of the model for this design.
 *
 * Deliberately explicit rather than "has a rep column mapped": a Factorial CRD
 * must NOT send a block, because a synthetic block is exactly what aliased
 * Factor B away before the backend was fixed.
 */
export function requiresBlock(design: GovernedDesignType): boolean {
  return requiredRoles(design).includes("rep");
}

// ── Mapping ──────────────────────────────────────────────────────────────────

export type ColumnMapping = Partial<Record<ColumnRole, string>>;

/**
 * Reduce a mapping to only the roles the chosen design actually uses.
 * Columns left over from a previous design selection are dropped rather than
 * sent, so switching Factorial RCBD → Factorial CRD cannot smuggle a block in.
 */
export function activeMapping(
  design: GovernedDesignType,
  mapping: ColumnMapping
): ColumnMapping {
  const active: ColumnMapping = {};
  for (const role of requiredRoles(design)) {
    const value = mapping[role];
    if (value) active[role] = value;
  }
  return active;
}

// ── Frontend validation ──────────────────────────────────────────────────────

export interface ValidationIssue {
  message: string;
  roles: ColumnRole[];
}

/**
 * Block mappings that cannot possibly be analysed, before a request is sent.
 *
 * This is a pre-flight check, not a reimplementation of the backend validator:
 * balanced-complete structure, missing cells and lost factor levels are all
 * decided by the backend against the actual data. What is checked here is only
 * what is knowable from the mapping itself.
 */
export function validateMapping(
  design: GovernedDesignType,
  mapping: ColumnMapping,
  selectedTraits: string[]
): ValidationIssue | null {
  if (selectedTraits.length === 0) {
    return { message: "Select at least one response variable.", roles: [] };
  }

  const roles = requiredRoles(design);
  for (const role of roles) {
    if (!mapping[role]) {
      return {
        message: `Select a ${ROLE_LABELS[role]} column — it is required for ${designMeta(design).fullLabel}.`,
        roles: [role],
      };
    }
  }

  // Two roles pointing at the same column is always structurally impossible:
  // a column cannot simultaneously be, say, both factors of a cross.
  const seen = new Map<string, ColumnRole>();
  for (const role of roles) {
    const column = mapping[role] as string;
    const clash = seen.get(column);
    if (clash) {
      return {
        message: `${ROLE_LABELS[clash]} and ${ROLE_LABELS[role]} cannot be the same column ("${column}").`,
        roles: [clash, role],
      };
    }
    seen.set(column, role);
  }

  // Traits must not double as structural columns.
  for (const role of roles) {
    const column = mapping[role] as string;
    if (selectedTraits.includes(column)) {
      return {
        message: `"${column}" is mapped as ${ROLE_LABELS[role]} and also selected as a response variable.`,
        roles: [role],
      };
    }
  }

  return null;
}

// ── Structural preview ───────────────────────────────────────────────────────

export interface PreviewRow {
  label: string;
  value: string;
}

export interface StructuralPreview {
  design: GovernedDesignType;
  designLabel: string;
  rows: PreviewRow[];
  /** Levels counted per mapped structural column, when data rows are available. */
  levelCounts: Partial<Record<ColumnRole, number>>;
  expectedCombinations: number | null;
}

function distinctLevels(rows: Record<string, unknown>[], column: string): number {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = row?.[column];
    if (value === null || value === undefined || value === "") continue;
    seen.add(String(value));
  }
  return seen.size;
}

/**
 * Describe the structure implied by the current mapping.
 *
 * DESCRIPTIVE ONLY. Everything here is counted from the uploaded rows or read
 * straight off the user's own selections — no inferential decision, no
 * balanced-complete verdict, no reproduction of anything the backend decides.
 * "Expected treatment combinations" is the product of mapped factor levels,
 * i.e. what a complete design would contain — not a claim that the data is
 * complete.
 */
export function buildStructuralPreview(
  design: GovernedDesignType,
  mapping: ColumnMapping,
  alpha: number,
  previewRows: Record<string, unknown>[] = []
): StructuralPreview {
  const meta = designMeta(design);
  const active = activeMapping(design, mapping);
  const canCount = previewRows.length > 0;

  const levelCounts: Partial<Record<ColumnRole, number>> = {};
  for (const [role, column] of Object.entries(active) as [ColumnRole, string][]) {
    if (canCount) levelCounts[role] = distinctLevels(previewRows, column);
  }

  const rows: PreviewRow[] = [{ label: "Design", value: meta.fullLabel }];

  for (const role of meta.requiredRoles) {
    const column = active[role];
    if (!column) continue;
    const count = levelCounts[role];
    const suffix =
      count === undefined
        ? ""
        : role === "rep"
          ? ` · ${count} block${count === 1 ? "" : "s"}`
          : ` · ${count} level${count === 1 ? "" : "s"}`;
    rows.push({ label: ROLE_LABELS[role], value: `${column}${suffix}` });
  }

  // Treatment combinations a COMPLETE design would contain.
  let expectedCombinations: number | null = null;
  const treatmentRoles: ColumnRole[] = ["treatment", "factor_a", "factor_b", "main_plot", "sub_plot"];
  const counted = treatmentRoles
    .filter((role) => meta.requiredRoles.includes(role))
    .map((role) => levelCounts[role])
    .filter((n): n is number => typeof n === "number" && n > 0);
  if (counted.length > 0 && counted.length === meta.requiredRoles.filter((r) => treatmentRoles.includes(r)).length) {
    expectedCombinations = counted.reduce((a, b) => a * b, 1);
    rows.push({
      label: "Treatment combinations",
      value: `${expectedCombinations} (if complete)`,
    });
  }

  rows.push({ label: "Inferential α", value: alpha.toFixed(2) });

  return {
    design,
    designLabel: meta.fullLabel,
    rows,
    levelCounts,
    expectedCombinations,
  };
}

// ── Governed request construction ────────────────────────────────────────────

export interface BuildAnovaRequestInput {
  datasetContext: {
    base64Content: string;
    fileType: "csv" | "xlsx" | "xls";
    genotypeColumn: string;
    repColumn: string;
    environmentColumn: string | null;
    environmentFactorColumns?: string[];
    mode: "single" | "multi";
  };
  design: GovernedDesignType;
  alpha: AnovaAlpha;
  mapping: ColumnMapping;
  traits: string[];
}

/**
 * Build the governed /genetics/analyze-upload request.
 *
 * The single authoritative place an ANOVA payload is constructed. Column roles
 * come from `activeMapping`, so only the roles the chosen design uses are sent:
 * a Factorial CRD carries no `rep_column`, which is what keeps the backend on
 * the true A*B model rather than the synthetic-block model that aliased Factor
 * B away.
 *
 * `factor_c_column` is never populated. Three-factor factorial remains LIMITED
 * / EXPERIMENTAL; the backend still accepts it, but it is not part of the
 * governed v1 workflow.
 */
export function buildAnovaRequest(input: BuildAnovaRequestInput): UploadAnalysisRequest {
  const { datasetContext: ctx, design, alpha, mapping, traits } = input;
  const active = activeMapping(design, mapping);
  const usesBlock = requiresBlock(design);

  // `genotype_column` is the backend's one-factor treatment slot and is a
  // required wire field. For designs with no single treatment factor it falls
  // back to whatever the dataset detected, which the backend ignores in favour
  // of the explicit factor/plot roles.
  const treatment = active.treatment ?? ctx.genotypeColumn ?? "";

  return {
    base64_content: ctx.base64Content,
    file_type: ctx.fileType,
    genotype_column: treatment,
    // Empty rather than the detected column when the design has no block:
    // sending a stray block is the synthetic-block failure mode.
    rep_column: usesBlock ? (active.rep ?? "") : "",
    environment_column: ctx.environmentColumn ?? null,
    environment_factor_columns: ctx.environmentFactorColumns ?? [],
    trait_columns: traits,
    mode: ctx.mode,
    random_environment: false,
    selection_intensity: 2.04,
    module: "anova",
    alpha,
    design_type: design,
    treatment_column: active.treatment,
    factor_a_column: active.factor_a,
    factor_b_column: active.factor_b,
    main_plot_column: active.main_plot,
    sub_plot_column: active.sub_plot,
  };
}

// ── Backend structural error translation ─────────────────────────────────────

/**
 * Governed structural rejection codes emitted by the backend before any model
 * is fitted, paired with a concise statement of the statistical reason.
 *
 * The raw code is never discarded — the panel shows it in a details area so a
 * support conversation can start from the same string the backend emitted.
 */
const STRUCTURAL_ERROR_MESSAGES: Record<string, string> = {
  // ── One-factor RCBD ──
  rcbd_missing_cells:
    "The RCBD is incomplete: at least one treatment is missing from at least one block. A complete block design requires every treatment in every block.",
  rcbd_missing_and_duplicate_cells:
    "The RCBD has both missing and duplicated treatment × block cells. Each treatment must appear exactly once per block.",
  rcbd_missing_structural_identifier:
    "A required structural column (treatment or replication) is missing or empty for some rows.",

  // ── Factorial ──
  factorial_crd_missing_cells:
    "The factorial is incomplete: at least one Factor A × Factor B combination has no observations, so the interaction cannot be estimated.",
  factorial_rcbd_missing_block_column:
    "Factorial RCBD requires a replication / block column. The block is part of the model and cannot be inferred from row order — map it, or choose Factorial CRD if the replicates are independent units rather than blocks.",
  factorial_rcbd_incomplete_or_duplicated_blocks:
    "The factorial RCBD is incomplete or duplicated: every Factor A × Factor B combination must appear exactly once in every block.",
  factorial_factor_level_lost_to_missing_response:
    "A factor level has no usable response values, so it drops out of the model and the design is no longer balanced-complete.",
  factorial_missing_structural_identifier:
    "A required structural column (Factor A, Factor B, or block) is missing or empty for some rows.",

  // ── Split-plot ──
  split_plot_missing_whole_plot:
    "At least one whole plot is missing from a block. Every whole-plot level must appear in every block.",
  split_plot_incomplete_or_duplicated_subplots:
    "The subplot layout is incomplete or duplicated: each subplot level must appear exactly once within every whole plot.",
  split_plot_insufficient_blocks:
    "Too few blocks to estimate whole-plot error (Error A). A split-plot needs at least two blocks.",
  split_plot_insufficient_whole_plot_levels:
    "Too few whole-plot factor levels to estimate whole-plot error (Error A). At least two are required.",
  split_plot_insufficient_sub_plot_levels:
    "Too few subplot factor levels. At least two are required to estimate the subplot effect.",
  split_plot_level_lost_to_missing_response:
    "A whole-plot or subplot level has no usable response values, so the split-plot structure is no longer complete.",
  split_plot_missing_structural_identifier:
    "A required structural column (block, whole-plot factor, or subplot factor) is missing or empty for some rows.",

  // ── Shared ──
  missing_cells:
    "The design is incomplete: at least one expected treatment combination has no observations.",
  missing_response_rows:
    "Some rows have no response value, leaving the design incomplete.",
  missing_treatment:
    "A treatment / factor column is required but was not mapped.",
};

export interface StructuralErrorDisplay {
  /** Concise user-facing statement of the statistical reason. */
  message: string;
  /** The backend code, when one was present. Shown in a details area. */
  code: string | null;
  /** The untouched backend text, for support and reproducibility. */
  raw: string;
}

/**
 * Translate a backend structural failure into a concise message, preserving the
 * code and the original text.
 *
 * Codes are emitted in square brackets, e.g. "[split_plot_insufficient_blocks]",
 * or appear as a bare snake_case token in the message.
 */
export function describeStructuralError(raw: string | null | undefined): StructuralErrorDisplay {
  const text = (raw ?? "").trim();
  if (!text) {
    return { message: "The analysis failed for an unspecified reason.", code: null, raw: "" };
  }

  const bracketed = text.match(/\[([a-z0-9_]+)\]/);
  let code = bracketed ? bracketed[1] : null;
  if (!code) {
    for (const known of Object.keys(STRUCTURAL_ERROR_MESSAGES)) {
      if (text.includes(known)) {
        code = known;
        break;
      }
    }
  }

  if (code && STRUCTURAL_ERROR_MESSAGES[code]) {
    return { message: STRUCTURAL_ERROR_MESSAGES[code], code, raw: text };
  }

  // Unknown code: never invent a reason — show the backend's own words.
  const withoutCode = text.replace(/\s*\[[a-z0-9_]+\]\s*$/, "").trim();
  return { message: withoutCode || text, code, raw: text };
}

// ── Legacy handling ──────────────────────────────────────────────────────────

/**
 * Label a design identifier read back from stored history.
 *
 * A stored `factorial` is NOT silently re-read as Factorial CRD: the legacy
 * selector required a replication column, so most such runs were blocked
 * factorials — but the record does not say which, and guessing would
 * misattribute the model actually fitted.
 */
export function labelStoredDesign(stored: string | null | undefined): string {
  if (!stored) return "Unspecified design";
  if (stored === "factorial") return "Legacy factorial (block structure unrecorded)";
  const meta = GOVERNED_DESIGNS.find((d) => d.id === stored);
  return meta ? meta.fullLabel : stored;
}

export function isLegacyDesignId(stored: string | null | undefined): boolean {
  return stored === "factorial";
}
