/**
 * Audit finding: sign-in fields had visible labels that were not associated
 * with their inputs, so the inputs had no accessible name, and no autocomplete
 * tokens were set for password managers.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {}, from: vi.fn() } }));
vi.mock("@/components/Logo", () => ({ Logo: () => null }));

import VivaSenseAuth from "../VivaSenseAuth";

function renderAuth() {
  return render(
    <MemoryRouter initialEntries={["/auth"]}>
      <VivaSenseAuth />
    </MemoryRouter>,
  );
}

describe("sign-in form accessibility", () => {
  it("gives the email and password inputs accessible names from their labels", () => {
    renderAuth();
    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    expect(email.tagName).toBe("INPUT");
    expect(email).toHaveAttribute("type", "email");
    expect(password).toHaveAttribute("type", "password");
    expect(screen.getByRole("textbox", { name: "Email" })).toBe(email);
  });

  it("uses email and current-password autocomplete tokens on sign-in", () => {
    renderAuth();
    expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
  });

  it("keeps the label association when the password is revealed", () => {
    renderAuth();
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("textbox", { name: "Password" })).toBe(password);
  });

  it("labels every registration field and uses new-password for both password fields", () => {
    renderAuth();
    fireEvent.click(screen.getByRole("button", { name: /create|register|sign up/i }));
    const expectations: Array<[RegExp, string | null]> = [
      [/^Full Name/, "name"],
      [/^Email Address/, "email"],
      [/^Institution/, "organization"],
      [/^Position/, "organization-title"],
      [/^Research Area/, null],
      [/^How did you hear/, null],
      [/^Password \*/, "new-password"],
      [/^Confirm Password/, "new-password"],
    ];
    for (const [label, token] of expectations) {
      const field = screen.getByLabelText(label);
      if (token) expect(field).toHaveAttribute("autocomplete", token);
    }
    // Ids are unique so each label targets exactly one control.
    const ids = Array.from(document.querySelectorAll("input[id], select[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
