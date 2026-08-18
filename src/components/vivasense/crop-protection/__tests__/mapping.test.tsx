/**
 * Role and response mapping.
 *
 * Every scientific role must be declared explicitly, Replicate must never be
 * presented as a block, and no Block selector may exist in a CRD workflow.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BioassayResponseMapping } from "../BioassayResponseMapping";
import { emptyDraft } from "../drafts";
import { BioassayRoleMapping, type RoleMappingState } from "../BioassayRoleMapping";
import { BioassayPanel } from "../BioassayPanel";

const COLUMNS = ["Treatment", "Dose", "Rep", "Mort48_pct", "AdtM48", "WTL"];

const EMPTY_ROLES: RoleMappingState = {
  treatmentColumn: "",
  doseColumn: "",
  replicateColumn: "",
  controlLevel: "",
  doseSeriesText: "",
};

describe("Role mapping", () => {
  it("asks for Treatment, Dose, Replicate and Control explicitly", () => {
    render(
      <BioassayRoleMapping
        columns={COLUMNS}
        controlSuggestions={["C"]}
        value={EMPTY_ROLES}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("Treatment column")).toBeInTheDocument();
    expect(screen.getByText("Dose / Concentration column")).toBeInTheDocument();
    expect(screen.getByText("Replicate column")).toBeInTheDocument();
    expect(screen.getByText("Control treatment level")).toBeInTheDocument();
    expect(screen.getByText("Expected dose levels")).toBeInTheDocument();
  });

  it("explains that Replicate is not a block, and offers no Block selector", () => {
    render(
      <BioassayRoleMapping
        columns={COLUMNS}
        controlSuggestions={[]}
        value={EMPTY_ROLES}
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByText(/Replicate identifies independent experimental units in a CRD/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/not automatically treated as a block/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Block column$/i)).toBeNull();
    expect(screen.queryByText(/Block \/ Replication/i)).toBeNull();
  });

  it("uses crop-protection vocabulary, not genetics vocabulary", () => {
    const { container } = render(
      <BioassayRoleMapping
        columns={COLUMNS}
        controlSuggestions={[]}
        value={EMPTY_ROLES}
        onChange={vi.fn()}
      />
    );
    const text = (container.textContent ?? "").toLowerCase();
    expect(text).not.toContain("genotype");
    expect(text).not.toContain("entry column");
    expect(text).not.toContain("environment");
  });
});

describe("Response mapping", () => {
  it("requires the raw/display and inference columns to be chosen, not inferred", () => {
    render(
      <BioassayResponseMapping
        columns={COLUMNS}
        drafts={[emptyDraft(0)]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("Raw / display column")).toBeInTheDocument();
    expect(screen.getByText("Inference column")).toBeInTheDocument();
    expect(screen.getByText("Response name")).toBeInTheDocument();
    expect(screen.getByText("Biological type")).toBeInTheDocument();
  });

  it("shows the transformation provenance note when the two scales differ", () => {
    const draft = {
      ...emptyDraft(0),
      id: "Mortality 48 h",
      rawColumn: "Mort48_pct",
      inferenceColumn: "AdtM48",
    };
    render(
      <BioassayResponseMapping columns={COLUMNS} drafts={[draft]} onChange={vi.fn()} />
    );
    // The columns also appear in their select triggers, so assert on the note.
    const note = screen.getByText(/Inference:/);
    expect(note).toBeInTheDocument();
    expect(note.textContent).toContain("AdtM48");
    expect(note.textContent).toContain("Mort48_pct");
    expect(note.textContent).toMatch(/reported means stay on the biological scale/i);
  });

  it("offers Abbott correction only on mortality responses", () => {
    const mortality = { ...emptyDraft(0), type: "mortality" as const };
    const { rerender } = render(
      <BioassayResponseMapping columns={COLUMNS} drafts={[mortality]} onChange={vi.fn()} />
    );
    expect(screen.getByText("Abbott correction")).toBeInTheDocument();

    rerender(
      <BioassayResponseMapping
        columns={COLUMNS}
        drafts={[{ ...mortality, type: "continuous" }]}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByText("Abbott correction")).toBeNull();
  });
});

describe("Workflow validation", () => {
  it("blocks the run until a dataset is uploaded", () => {
    render(<BioassayPanel />);
    expect(screen.getByText(/Upload a bioassay dataset to begin/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Run Analysis/i })).toBeNull();
  });
});
