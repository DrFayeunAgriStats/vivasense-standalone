/**
 * W1-INT-09 — DatasetUpload is the authoritative lifecycle owner for
 * `datasetInstanceId` in the governed ANOVA workflow: `handleConfirmMapping`
 * is the one place a `DatasetContext` is constructed for it. These tests
 * pin the lifecycle contract established in the implementation report:
 *
 *  - a completed "Confirm Mapping & Prepare Dataset" action always mints a
 *    fresh, valid instance id, independent of whatever the backend's
 *    operational dataset_token turned out to be (including null);
 *  - re-selecting a file with identical name/size/lastModified through a
 *    new selection action still mints a NEW id (a selection event, not the
 *    file's bytes, is what the id identifies);
 *  - a failed preview never reaches `onDatasetReady` at all, so no instance
 *    id is ever minted for it, and any previously-active dataset is
 *    reachable to the parent only via its own explicit "Upload New Dataset"
 *    action (never silently/ambiguously by a failed replacement attempt).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import type { DatasetContext, UploadPreviewResponse } from "@/types/geneticsUpload";

const uploadPreviewMock = vi.hoisted(() => vi.fn());
const fileToBase64Mock = vi.hoisted(() => vi.fn().mockResolvedValue("QkFTRTY0"));
vi.mock("@/lib/geneticsUploadApi", () => ({
  uploadPreview: uploadPreviewMock,
  fileToBase64: fileToBase64Mock,
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { DatasetUpload } from "../DatasetUpload";

afterEach(() => {
  cleanup();
  uploadPreviewMock.mockReset();
  fileToBase64Mock.mockReset().mockResolvedValue("QkFTRTY0");
});

function buildPreviewResponse(over: Partial<UploadPreviewResponse> = {}): UploadPreviewResponse {
  return {
    detected_columns: {
      genotype: { column: "Genotype", confidence: "high" },
      rep: { column: "Rep", confidence: "high" },
      environment: null,
      traits: ["Yield_kg"],
    },
    n_rows: 4,
    n_columns: 3,
    data_preview: [{ Genotype: "G01", Rep: "R1", Yield_kg: 10 }],
    mode_suggestion: "single",
    column_names: ["Genotype", "Rep", "Yield_kg"],
    warnings: [],
    dataset_token: "ds-token-1",
    ...over,
  } as UploadPreviewResponse;
}

async function uploadAndConfirm(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /^Preview$/i }));
  await screen.findByText(/Column Mapping/i);
  fireEvent.click(screen.getByRole("button", { name: /Confirm Mapping & Prepare Dataset/i }));
}

describe("W1-INT-09 — DatasetUpload dataset-instance lifecycle", () => {
  it("A/P — a successful confirm mints a valid, non-empty instanceId even when the operational token is null", async () => {
    // The declared UploadPreviewResponse type says `dataset_token?: string`
    // (no `| null`), but the real backend can send a JSON `null` here (see
    // multitrait_upload_routes.py's try/except around token issuance) --
    // that pre-existing type/reality gap is unrelated to this ticket, so the
    // cast below exercises the actual runtime shape rather than only what
    // the (already imprecise) type permits.
    uploadPreviewMock.mockResolvedValueOnce(
      buildPreviewResponse({ dataset_token: null as unknown as string })
    );
    let received: DatasetContext | null = null;
    render(<DatasetUpload datasetContext={null} onDatasetReady={(ctx) => { received = ctx; }} />);

    await uploadAndConfirm(new File(["a"], "fixture.csv"));

    await waitFor(() => expect(received).not.toBeNull());
    expect(received!.datasetToken).toBeNull();
    expect(typeof received!.datasetInstanceId).toBe("string");
    expect(received!.datasetInstanceId.trim().length).toBeGreaterThan(0);
  });

  it("I/J — a second confirm (even reselecting an identical file) mints a DIFFERENT instanceId than the first", async () => {
    uploadPreviewMock.mockResolvedValue(buildPreviewResponse());
    const received: DatasetContext[] = [];
    const onDatasetReady = (ctx: DatasetContext) => received.push(ctx);
    const { rerender } = render(<DatasetUpload datasetContext={null} onDatasetReady={onDatasetReady} />);

    const identicalContentFile = () => new File(["identical-bytes"], "same-name.csv", { lastModified: 12345 });

    await uploadAndConfirm(identicalContentFile());
    await waitFor(() => expect(received.length).toBe(1));

    // Simulate the researcher clicking "Upload New Dataset" (parent clears
    // datasetContext back to null) and reselecting -- by construction here,
    // a file with the SAME name/bytes/lastModified as before.
    rerender(<DatasetUpload datasetContext={null} onDatasetReady={onDatasetReady} />);
    await uploadAndConfirm(identicalContentFile());
    await waitFor(() => expect(received.length).toBe(2));

    expect(received[0].datasetInstanceId).not.toBe(received[1].datasetInstanceId);
  });

  it("J/N — a failed preview never calls onDatasetReady, so no instance id is minted for it", async () => {
    uploadPreviewMock.mockRejectedValueOnce(new Error("backend rejected the file"));
    const onDatasetReady = vi.fn();
    render(<DatasetUpload datasetContext={null} onDatasetReady={onDatasetReady} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["bad"], "corrupt.csv")] } });
    fireEvent.click(screen.getByRole("button", { name: /^Preview$/i }));

    await waitFor(() => expect(uploadPreviewMock).toHaveBeenCalledTimes(1));
    // No "Column Mapping" step, no Confirm button, no onDatasetReady call --
    // the failed attempt leaves nothing for a stale/ambiguous state to form
    // around.
    expect(screen.queryByText(/Column Mapping/i)).toBeNull();
    expect(onDatasetReady).not.toHaveBeenCalled();
  });

  it("K — an already-active dataset is shown as a compact summary, with its own explicit replacement action, rather than exposing the file picker directly", () => {
    const active: DatasetContext = {
      file: new File(["a"], "active.csv"),
      base64Content: "AAAA",
      fileType: "csv",
      genotypeColumn: "Genotype",
      repColumn: "Rep",
      environmentColumn: null,
      availableTraitColumns: ["Yield_kg"],
      mode: "single",
      datasetInstanceId: "instance-active",
      datasetToken: null,
    };
    render(<DatasetUpload datasetContext={active} onDatasetReady={vi.fn()} />);

    expect(screen.getByText(/Dataset loaded:/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Preview$/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Upload New Dataset/i })).toBeTruthy();
  });
});
