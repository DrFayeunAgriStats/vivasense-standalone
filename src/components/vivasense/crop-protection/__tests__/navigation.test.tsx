/**
 * Navigation: Crop Protection is reachable, and its only active child workflow
 * opens. Future children (pathology, LC50, repellency, AUDPC) must not appear.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CropProtectionDashboard } from "../CropProtectionDashboard";

vi.mock("@/services/cropProtectionApi", async () => {
  const actual = await vi.importActual<typeof import("@/services/cropProtectionApi")>(
    "@/services/cropProtectionApi"
  );
  return { ...actual, analyzeBioassay: vi.fn() };
});

describe("Crop Protection navigation", () => {
  it("appears in the workspace sidebar", async () => {
    const { Layout } = await import("@/components/layout/Layout");
    render(
      <MemoryRouter initialEntries={["/workspace?module=crop-protection"]}>
        <Layout>
          <div />
        </Layout>
      </MemoryRouter>
    );
    expect(screen.getByText("Crop Protection")).toBeInTheDocument();
  });

  it("offers Bioassay / Efficacy Analysis and opens it", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CropProtectionDashboard />
      </MemoryRouter>
    );

    expect(screen.getByText("Bioassay / Efficacy Analysis")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Open Bioassay \/ Efficacy Analysis/i }));

    expect(screen.getByText("Upload Dataset")).toBeInTheDocument();
  });

  it("does not advertise workflows the backend cannot run yet", () => {
    render(
      <MemoryRouter>
        <CropProtectionDashboard />
      </MemoryRouter>
    );
    for (const notYet of [/LC50/i, /LC90/i, /Repellency/i, /AUDPC/i, /Plant Pathology/i, /probit/i]) {
      expect(screen.queryByText(notYet)).toBeNull();
    }
  });

  it("deep-links straight into the bioassay workflow", () => {
    render(
      <MemoryRouter>
        <CropProtectionDashboard initialWorkflow="bioassay" />
      </MemoryRouter>
    );
    expect(screen.getByText("Upload Dataset")).toBeInTheDocument();
  });
});
