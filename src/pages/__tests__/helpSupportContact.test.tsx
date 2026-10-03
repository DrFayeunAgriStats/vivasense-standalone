/**
 * FE-BETA-02b: the Help troubleshooting guide gives the authorised support
 * address. The product's canonical domain is vivasensestat.com (index.html
 * canonical URL, auth page, Supabase provisioning); nothing in the repository
 * establishes vivasense.app as a support domain.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import HelpLearning from "../HelpLearning";
import { allTutorials } from "@/data/helpLearningContent";

describe("Help troubleshooting support contact", () => {
  it("shows support@vivasensestat.com on the troubleshooting guide", () => {
    render(
      <MemoryRouter initialEntries={["/help/troubleshooting"]}>
        <Routes>
          <Route path="/help/:tutorialSlug" element={<HelpLearning />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/support@vivasensestat\.com/)).toBeInTheDocument();
    expect(screen.queryByText(/support@vivasense\.app/)).not.toBeInTheDocument();
  });

  it("no Help guide content uses the unverified vivasense.app support address", () => {
    expect(JSON.stringify(allTutorials)).not.toContain("support@vivasense.app");
  });
});
