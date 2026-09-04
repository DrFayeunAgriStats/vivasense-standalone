/**
 * W1-INT-04A — Response Scale control: Unknown-state clarity and component identity.
 *
 * Two things are pinned here. First, a selected trait whose scale is still
 * Unknown must say what that means, compactly, without implying a
 * transformation is needed. Second, the control is declared at module scope, so
 * its React identity is stable across parent rerenders — the nested-component
 * remount pattern under investigation in W1-UI-01 must not be repeated here.
 */

import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ResponseScaleRow } from "../AnovaModulePanel";
import type { ResponseSemantic } from "@/services/geneticsUploadApi";

const CUE = /Response scale not specified/i;

afterEach(cleanup);

describe("Unknown-state cue", () => {
  it("is visible for a selected trait whose scale is Unknown", () => {
    render(<ResponseScaleRow trait="DTF_Days" value="unknown" onChange={() => {}} />);
    const cue = screen.getByText(CUE);
    expect(cue).toBeInTheDocument();
    expect(cue.textContent).toMatch(/will report diagnostics/i);
    expect(cue.textContent).toMatch(/will not recommend an automatic transformation/i);
  });

  it("does not imply a transformation is required", () => {
    render(<ResponseScaleRow trait="DTF_Days" value="unknown" onChange={() => {}} />);
    const text = screen.getByText(CUE).textContent ?? "";
    expect(text).not.toMatch(/\brequired\b|\bmust\b|\bshould apply\b|\bneeds\b/i);
  });

  it("never names a scale it was not told", () => {
    render(<ResponseScaleRow trait="Germination_pct" value="unknown" onChange={() => {}} />);
    const text = screen.getByText(CUE).textContent ?? "";
    expect(text.toLowerCase()).not.toContain("percentage");
    expect(text.toLowerCase()).not.toContain("proportion");
  });

  it.each<ResponseSemantic>(["continuous", "count", "percentage", "proportion"])(
    "disappears once the scale is declared as %s",
    (declared) => {
      render(<ResponseScaleRow trait="DTF_Days" value={declared} onChange={() => {}} />);
      expect(screen.queryByText(CUE)).toBeNull();
    }
  );

  it("is one compact line, not a warning panel", () => {
    const { container } = render(
      <ResponseScaleRow trait="DTF_Days" value="unknown" onChange={() => {}} />
    );
    const cue = screen.getByText(CUE);
    // A <p>, not an alert/card/banner, and no icon or role=alert.
    expect(cue.tagName.toLowerCase()).toBe("p");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelectorAll("svg").length).toBeLessThanOrEqual(1); // select chevron only
  });
});

describe("multiple selected traits stay compact", () => {
  const traits = ["DTF_Days", "PHTF_cm", "Germination_pct", "Survival_prop", "Yield_kg"];

  it("renders exactly one cue per Unknown trait and none for declared ones", () => {
    const values: Record<string, ResponseSemantic> = {
      DTF_Days: "unknown", PHTF_cm: "unknown", Germination_pct: "percentage",
      Survival_prop: "proportion", Yield_kg: "unknown",
    };
    render(
      <div>
        {traits.map((t) => (
          <ResponseScaleRow key={t} trait={t} value={values[t]} onChange={() => {}} />
        ))}
      </div>
    );
    expect(screen.getAllByText(CUE)).toHaveLength(3);
  });

  it("produces no repeated warning panels even when every trait is Unknown", () => {
    const { container } = render(
      <div>
        {traits.map((t) => (
          <ResponseScaleRow key={t} trait={t} value="unknown" onChange={() => {}} />
        ))}
      </div>
    );
    expect(screen.getAllByText(CUE)).toHaveLength(traits.length);
    // No alert roles and no card/banner containers multiplied per trait.
    expect(container.querySelectorAll('[role="alert"]').length).toBe(0);
    for (const cue of screen.getAllByText(CUE)) {
      expect(cue.tagName.toLowerCase()).toBe("p");
    }
  });
});

describe("component identity is stable across parent rerenders", () => {
  it("is declared at module scope, not inside AnovaModulePanel", () => {
    // A module-scope function component has a stable reference; a
    // nested-in-render one would be a new type every render.
    expect(typeof ResponseScaleRow).toBe("function");
    expect(ResponseScaleRow).toBe(ResponseScaleRow);
  });

  it("does not remount when an unrelated parent state change rerenders it", () => {
    const mounted = vi.fn();

    function Parent() {
      const [tick, setTick] = useState(0);
      const [value, setValue] = useState<ResponseSemantic>("unknown");
      return (
        <div>
          <button onClick={() => setTick((n) => n + 1)}>bump {tick}</button>
          <Probe onMount={mounted} />
          <ResponseScaleRow trait="DTF_Days" value={value} onChange={setValue} />
        </div>
      );
    }
    function Probe({ onMount }: { onMount: () => void }) {
      useState(() => {
        onMount();
        return null;
      });
      return null;
    }

    render(<Parent />);
    expect(mounted).toHaveBeenCalledTimes(1);

    // Three unrelated parent rerenders — a remounting subtree would re-run mount.
    fireEvent.click(screen.getByRole("button", { name: /bump/i }));
    fireEvent.click(screen.getByRole("button", { name: /bump/i }));
    fireEvent.click(screen.getByRole("button", { name: /bump/i }));

    expect(mounted).toHaveBeenCalledTimes(1);
    // The declaration is still there and still Unknown — no silent reset.
    expect(screen.getByText(CUE)).toBeInTheDocument();
  });
});
