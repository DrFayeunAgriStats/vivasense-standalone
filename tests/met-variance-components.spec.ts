import { expect, test } from "playwright/test";
import {
  buildVarianceComponentRows,
  buildVarianceComponentsRequests,
  formatVarianceComponentsError,
} from "../src/lib/varianceComponentsMapping";
import type { DatasetContext, GeneticParametersTraitResult } from "../src/types/geneticsUpload";

function dataset(overrides: Partial<DatasetContext> = {}): DatasetContext {
  return {
    file: {} as File,
    base64Content: "dataset-base64",
    fileType: "csv",
    genotypeColumn: "Genotype",
    repColumn: "Rep",
    environmentColumn: null,
    environmentFactorColumns: [],
    availableTraitColumns: ["Yield"],
    mode: "single",
    columns: ["Genotype", "Rep", "Location", "Year", "Environment", "Yield"],
    ...overrides,
  };
}

function selection(mode: "single" | "multi", design: "crd" | "rcbd" = "rcbd") {
  return {
    mode,
    design,
    genotypeColumn: "Genotype",
    repColumn: "Rep",
    traitColumns: ["Yield"],
  };
}

const metResult: GeneticParametersTraitResult = {
  trait: "Yield",
  status: "success",
  grand_mean: 20,
  variance_components: {
    sigma2_genotype: 4,
    sigma2_ge: 2,
    sigma2_error: 3,
    sigma2_phenotypic: 5,
  },
  heritability: { h2_broad_sense: 0.8 },
  gcv: 10,
  pcv: 12,
  ga: 3.5,
  gam: 17.5,
};

test.describe("multi-environment variance components mapping", () => {
  test("single-environment mode still registers mode single without environment structure", () => {
    const requests = buildVarianceComponentsRequests(dataset(), selection("single", "rcbd"));
    expect(requests.registration).toMatchObject({
      mode: "single",
      environment_column: null,
      environment_factor_columns: [],
      rep_column: "Rep",
    });
    expect(requests.analysis.mode).toBe("single");
  });

  test("single-environment CRD remains unblocked and does not send Rep", () => {
    const requests = buildVarianceComponentsRequests(dataset(), selection("single", "crd"));
    expect(requests.registration.rep_column).toBeNull();
    expect(requests.registration.design_type).toBe("crd");
  });

  test("explicit Environment MET sends the original Environment and Rep columns", () => {
    const requests = buildVarianceComponentsRequests(
      dataset({ mode: "multi", environmentColumn: "Environment" }),
      selection("multi"),
    );
    expect(requests.registration).toMatchObject({
      mode: "multi",
      environment_column: "Environment",
      environment_factor_columns: [],
      rep_column: "Rep",
      design_type: "rcbd",
    });
  });

  test("Location and Year MET preserves factor order without synthetic labels", () => {
    const requests = buildVarianceComponentsRequests(
      dataset({ mode: "multi", environmentFactorColumns: ["Location", "Year"] }),
      selection("multi"),
    );
    expect(requests.registration.environment_column).toBeNull();
    expect(requests.registration.environment_factor_columns).toEqual(["Location", "Year"]);
    expect(JSON.stringify(requests.registration)).not.toContain("_vivasense_environment");
    expect(JSON.stringify(requests.registration)).not.toContain("Location_Year");
  });

  test("multi mode never enables random environment", () => {
    const requests = buildVarianceComponentsRequests(
      dataset({ mode: "multi", environmentColumn: "Environment" }),
      selection("multi"),
    );
    expect(requests.registration.random_environment).toBe(false);
  });

  test("multi result rows display sigma2_ge and entry-mean phenotypic variance", () => {
    const rows = buildVarianceComponentRows(metResult, "multi");
    expect(rows).toContainEqual({
      label: "σ²ge (Genotype × Environment Variance)",
      value: "2.0000",
    });
    expect(rows).toContainEqual({ label: "Entry-mean Phenotypic Variance", value: "5.0000" });
  });

  test("multi H2 is labelled as across-environment heritability of genotype means", () => {
    const label = buildVarianceComponentRows(metResult, "multi").find((row) => row.label.startsWith("H²"))?.label;
    expect(label).toContain("Across-environment broad-sense heritability of genotype means");
  });

  test("backend structural details remain visible in the multi-environment error", () => {
    const detail = "Trait 'Yield': incomplete Genotype × Environment crossing.";
    const message = formatVarianceComponentsError(detail, "multi");
    expect(message).toContain("complete, balanced multi-environment trial");
    expect(message).toContain(detail);
  });

  test("single-environment result labels remain unchanged", () => {
    const labels = buildVarianceComponentRows(metResult, "single").map((row) => row.label);
    expect(labels).toContain("σ²p (Phenotypic Variance)");
    expect(labels).toContain("H² (Broad-sense Heritability)");
    expect(labels).not.toContain("σ²ge (Genotype × Environment Variance)");
  });
});

function supabaseAuthStorageKey(): string {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL is required for authenticated Playwright tests");
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

test("ANOVA selector remains available and the page heading follows the selected analysis", async ({ page }) => {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const token = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: "met-ui-test", exp: expiresAt })).toString("base64url")}.`;
  await page.addInitScript(({ key, accessToken, exp }) => {
    localStorage.setItem(key, JSON.stringify({
      access_token: accessToken,
      refresh_token: "met-ui-refresh",
      expires_at: exp,
      expires_in: 3600,
      token_type: "bearer",
      user: {
        id: "met-ui-test",
        aud: "authenticated",
        role: "authenticated",
        email: "met-ui@example.test",
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-01-01T00:00:00.000Z",
      },
    }));
  }, { key: supabaseAuthStorageKey(), accessToken: token, exp: expiresAt });

  await page.goto("/workspace?module=anova");
  await expect(page.getByRole("heading", { level: 1, name: "ANOVA" })).toBeVisible();
  await page.getByRole("button", { name: /Variance Components & Heritability/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Variance Components & Heritability" })).toBeVisible();
  await page.getByRole("button", { name: /^ANOVA/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ANOVA" })).toBeVisible();
});
