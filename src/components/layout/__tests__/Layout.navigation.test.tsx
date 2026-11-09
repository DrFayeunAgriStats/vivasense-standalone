/**
 * REL-UI-01: the workspace sidebar links to General Correlation, labels it as
 * non-genetic, and leaves every existing link unchanged.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Layout } from "@/components/layout/Layout";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Layout><div data-testid="page">{path}</div></Layout>} />
        <Route path="/relationship-analysis/general" element={<Layout><div data-testid="general-page">General page</div></Layout>} />
      </Routes>
    </MemoryRouter>,
  );
}

const sidebar = () => screen.getByText("Research Tools").closest("aside") as HTMLElement;

describe("Workspace sidebar — General Correlation entry", () => {
  it("links General Correlation to /relationship-analysis/general", () => {
    renderAt("/workspace");
    const link = screen.getByTestId("nav-general-correlation");
    expect(link).toHaveAttribute("href", "/relationship-analysis/general");
    expect(within(link).getByText("General Correlation")).toBeInTheDocument();
  });

  it("labels the entry as observed-variable, non-genetic correlation", () => {
    renderAt("/workspace");
    const link = screen.getByTestId("nav-general-correlation");
    expect(link).toHaveTextContent("Observed variables · not genetic");
    expect(link).toHaveAttribute("title", expect.stringContaining("does not estimate genetic correlation"));
    expect(link).toHaveAccessibleName("General Correlation — Observed variables · not genetic");
    expect(link.textContent ?? "").not.toMatch(/\brg\b|genotypic|heritab/i);
  });

  it("preserves every workspace route while using clear research-stage module labels", () => {
    renderAt("/workspace");
    const nav = sidebar();
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => [a.textContent?.trim().split("Observed")[0], a.getAttribute("href")]);
    expect(hrefs).toEqual([
      ["Research Workspace", "/workspace"],
      ["Data Capture", "/data-capture"],
      ["Help & Learning", "/help"],
      ["ANOVA & Mean Separation", "/workspace?module=anova"],
      ["Field Layout", "/workspace?module=field-layout"],
      ["General Correlation", "/relationship-analysis/general"],
    ]);
  });

  it("does not add a link to the genetic Relationship page or hidden modules", () => {
    renderAt("/workspace");
    const nav = sidebar();
    expect(nav.querySelector('a[href="/relationship-analysis"]')).toBeNull();
    expect(within(nav).queryByText(/Crop Protection|Breeding & Genetic|Trait Association/)).toBeNull();
  });

  it("navigates to the General page and marks the entry active there", () => {
    renderAt("/workspace");
    fireEvent.click(screen.getByTestId("nav-general-correlation"));
    expect(screen.getByTestId("general-page")).toBeInTheDocument();
    expect(screen.getByTestId("nav-general-correlation").className).toContain("bg-primary-soft");
  });

  it("is not marked active on other pages", () => {
    renderAt("/workspace?module=anova");
    expect(screen.getByTestId("nav-general-correlation").className).not.toContain("bg-primary-soft");
  });
});
