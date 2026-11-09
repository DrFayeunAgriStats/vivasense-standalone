import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";
import { RecentAnalysesV3 } from "../RecentAnalysesV3";

function record(overrides: Partial<AnalysisHistoryRecord> = {}): AnalysisHistoryRecord {
  return {
    id: "analysis-1",
    user_id: "researcher-1",
    session_id: null,
    created_at: "2026-11-09T00:00:00Z",
    analysis_type: "anova",
    analysis_title: "Sample ANOVA",
    study_name: null,
    design_type: "crd",
    dataset_name: "sample.csv",
    dataset_token: null,
    traits: ["yield"],
    analysis_status: "success",
    execution_time_ms: 320,
    backend_endpoint: null,
    backend_version: null,
    frontend_version: null,
    institution: null,
    country: null,
    user_role: null,
    analysis_parameters: {},
    result_summary: {},
    notes: null,
    favorite: false,
    ...overrides,
  };
}

describe("Recent Analyses — saved-result availability", () => {
  it("does not show Open or Report for a successful CRD history record", () => {
    const onOpen = vi.fn();
    render(<RecentAnalysesV3 rows={[record()]} onOpen={onOpen} />);
    expect(screen.queryByRole("button", { name: /^Open$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Report$/ })).not.toBeInTheDocument();
    expect(screen.getByText("Not reopenable")).toBeInTheDocument();
    expect(screen.getByText(/download the Word report immediately/i)).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not offer Open for RCBD entries without a linked saved run", () => {
    render(<RecentAnalysesV3 rows={[record({ design_type: "rcbd" })]} />);
    expect(screen.queryByRole("button", { name: /^Open$/ })).not.toBeInTheDocument();
    expect(screen.getByText("Not reopenable")).toBeInTheDocument();
  });

  it("offers Open and Report for a completed RCBD run with a persistence id", () => {
    const r = record({
      design_type: "rcbd",
      analysis_parameters: { persistence_analysis_run_id: "durable-run-1" },
    });
    const onOpen = vi.fn();
    render(<RecentAnalysesV3 rows={[r]} onOpen={onOpen} />);
    expect(screen.getByRole("button", { name: /^Report$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Open$/ }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(r);
    expect(screen.queryByText("Not reopenable")).not.toBeInTheDocument();
  });

  it("does not offer Open for failed runs or non-ANOVA history", () => {
    render(<RecentAnalysesV3 rows={[
      record({ id: "fail", design_type: "rcbd", analysis_status: "failure", analysis_parameters: { persistence_analysis_run_id: "run-1" } }),
      record({ id: "correlation", analysis_type: "correlation", design_type: null }),
    ]} />);
    expect(screen.queryByRole("button", { name: /^Open$/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Not reopenable")).toHaveLength(2);
  });
});
