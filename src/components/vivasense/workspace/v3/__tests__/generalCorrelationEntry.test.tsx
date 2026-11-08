/**
 * REL-UI-01: General Correlation entry in the Research Workspace overview,
 * reachable on phones and tablets (the desktop sidebar is hidden there).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const studiesMock = vi.fn();
const analysesMock = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, profile: null }) }));
vi.mock("@/services/dataCapture/dataCaptureService", () => ({ listStudiesWithProgress: () => studiesMock() }));
vi.mock("@/services/history/historyService", () => ({ listRecentAnalyses: () => analysesMock() }));
vi.mock("@/services/preferences", () => ({ dismissOnboarding: vi.fn() }));
vi.mock("@/components/vivasense/studies/CreateStudyModal", () => ({ CreateStudyModal: () => null }));

import { GENERAL_CORRELATION_PATH, GeneralCorrelationCard } from "../GeneralCorrelationCard";
import { WorkspaceV3Dashboard } from "../WorkspaceV3Dashboard";

function hiddenAncestor(el: HTMLElement | null): string | null {
  for (let n = el; n; n = n.parentElement) {
    const cls = typeof n.className === "string" ? n.className.split(/\s+/) : [];
    if (cls.includes("hidden") || cls.some((c) => /^(sm|md|lg):block$/.test(c))) return n.className;
  }
  return null;
}

function renderDashboard() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/workspace"]}>
        <Routes>
          <Route path="/workspace" element={<WorkspaceV3Dashboard />} />
          <Route path={GENERAL_CORRELATION_PATH} element={<div data-testid="general-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  studiesMock.mockReset().mockResolvedValue([]);
  analysesMock.mockReset().mockResolvedValue([]);
});

describe("General Correlation card", () => {
  it("opens /relationship-analysis/general", () => {
    render(<MemoryRouter><GeneralCorrelationCard /></MemoryRouter>);
    expect(GENERAL_CORRELATION_PATH).toBe("/relationship-analysis/general");
    expect(screen.getByRole("link", { name: /Open General Correlation/ })).toHaveAttribute("href", "/relationship-analysis/general");
  });

  it("states ordinary Pearson/Spearman correlation, not genetic correlation", () => {
    render(<MemoryRouter><GeneralCorrelationCard /></MemoryRouter>);
    const card = screen.getByTestId("workspace-general-correlation");
    expect(screen.getByRole("heading", { name: "General Correlation" })).toBeInTheDocument();
    expect(card).toHaveTextContent("Ordinary Pearson or Spearman correlation between measured variables.");
    expect(card).toHaveTextContent("Not genetic correlation — no genotype, replication or design information is used.");
    expect(card.textContent ?? "").not.toMatch(/\brg\b|genotypic correlation|heritab/i);
  });
});

describe("Research Workspace overview", () => {
  it("shows the entry with no responsive-hiding class (phones and tablets)", async () => {
    window.innerWidth = 375;
    renderDashboard();
    const card = await screen.findByTestId("workspace-general-correlation");
    expect(hiddenAncestor(card)).toBeNull();
    expect(hiddenAncestor(screen.getByTestId("workspace-general-correlation-open"))).toBeNull();
  });

  it("shows the entry while workspace data is still loading", () => {
    studiesMock.mockReturnValue(new Promise(() => {}));
    analysesMock.mockReturnValue(new Promise(() => {}));
    renderDashboard();
    expect(screen.getByTestId("workspace-general-correlation")).toBeInTheDocument();
  });

  it("keeps the existing overview header and actions", async () => {
    renderDashboard();
    expect(screen.getByRole("heading", { name: "Research Workspace" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /New Analysis|Analyse my data/ }).length).toBeGreaterThanOrEqual(1);
  });

  it("navigates to the General Correlation page when opened", async () => {
    renderDashboard();
    fireEvent.click(await screen.findByTestId("workspace-general-correlation-open"));
    expect(await screen.findByTestId("general-page")).toBeInTheDocument();
  });
});
