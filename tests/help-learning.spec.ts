import { test, expect } from "playwright/test";

function supabaseAuthStorageKey(): string {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("VITE_SUPABASE_URL is required for authenticated Playwright tests");
  }
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

async function openHelpAsSignedInUser(page: import("playwright/test").Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: "help-test-user", exp: expiresAt })).toString("base64url")}.`;
  const storageKey = supabaseAuthStorageKey();
  await page.addInitScript(({ key, token, exp }) => {
    localStorage.setItem(key, JSON.stringify({
      access_token: token,
      refresh_token: "help-test-refresh-token",
      expires_at: exp,
      expires_in: 3600,
      token_type: "bearer",
      user: {
        id: "help-test-user",
        aud: "authenticated",
        role: "authenticated",
        email: "help-test@example.test",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-01-01T00:00:00.000Z",
      },
    }));
  }, { key: storageKey, token: accessToken, exp: expiresAt });
  await page.goto("/help");
}

test.describe("Help & Learning", () => {
  test("renders the Help & Learning route, tutorial directory, support area, and detail template", async ({ page }) => {
    await openHelpAsSignedInUser(page);

    await expect(page.getByRole("heading", { name: "Help & Learning" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Getting Started", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Analysis Tutorials", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Need help with your real data?", exact: true })).toBeVisible();

    await page.getByRole("link", { name: /Help/ }).first().click();
    await expect(page).toHaveURL(/\/help$/);

    await page.getByRole("link", { name: "Open tutorial" }).first().click();
    await expect(page.getByRole("heading", { level: 2, name: "What is it?" })).toBeVisible();
    await expect(page.getByText("Tutorial content under scientific review.").first()).toBeVisible();
  });

  test("filters tutorial cards by keyword", async ({ page }) => {
    await openHelpAsSignedInUser(page);
    await page.getByLabel("Search tutorials").fill("split plot");
    await expect(page.getByRole("heading", { name: "Split-plot RCBD" })).toBeVisible();
    await expect(page.getByText("1 tutorial found")).toBeVisible();
  });

  test("stacks safely on mobile and leaves the existing workspace route protected", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openHelpAsSignedInUser(page);

    await expect(page.getByRole("heading", { name: "Help & Learning" })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    const storageKey = supabaseAuthStorageKey();
    await page.addInitScript((key) => localStorage.removeItem(key), storageKey);
    await page.goto("/workspace");
    await expect(page).toHaveURL(/\/auth\?next=%2Fworkspace/);
  });
});
