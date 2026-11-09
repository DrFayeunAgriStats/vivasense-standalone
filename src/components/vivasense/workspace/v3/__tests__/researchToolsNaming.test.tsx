import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingModules } from "../OnboardingModules";

describe("Research Tools naming and navigation", () => {
  it("labels ANOVA distinctly from layout and still opens the same module", () => {
    const navigate=vi.fn(), dismiss=vi.fn();
    render(<OnboardingModules onNavigate={navigate} onDismiss={dismiss} />);
    expect(screen.getByRole("heading", {name:"Research Tools"})).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", {name:/ANOVA & Mean Separation/}));
    expect(navigate).toHaveBeenCalledWith("start-analysis");
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", {name:/Field Layout/})).toBeInTheDocument();
    expect(screen.getByRole("button", {name:/Data Capture/})).toBeInTheDocument();
  });
});
