/**
 * Navigation: during Early Access, Crop Protection is NOT advertised in the
 * workspace sidebar (Layout.tsx lists only modules that have passed the
 * current verification gate). Its dashboard and only active child workflow
 * still render when opened directly. Future children (pathology, LC50,
 * repellency, AUDPC) must not appear.
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
  it("is hidden from the Early Access workspace sidebar, which lists only verified modules", async () => {
    const { Layout } = await import("@/components/layout/Layout");
    render(
      <MemoryRouter initialEntries={["/workspace?module=crop-protection"]}>
        <Layout>
          <div />
        </Layout>
      </MemoryRouter>
    );
    // Hidden even when the crop-protection module is the active one.
    expect(screen.queryByText("Crop Protection")).toBeNull();
    expect(screen.queryByText(/Crop Protection Analytics/i)).toBeNull();
    // The Early Access module list is exactly the verified modules.
    expect(screen.getByText("Experimental Design")).toBeInTheDocument();
    expect(screen.getByText("Field Layout")).toBeInTheDocument();
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
