// Browser test of the REAL standalone Advanced Analytics UI against a REAL backend (release branch) with synthetic reference data.
// Usage: API=http://localhost:8111 UI=http://localhost:5173 DATA=<release-verification dir> node e2e/advanced_release.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
import fs from "node:fs"; import path from "node:path";
const API = process.env.API ?? "http://localhost:8111", UI = process.env.UI ?? "http://localhost:5173", DATA = process.env.DATA;
const OUT = path.resolve("e2e/out"); fs.mkdirSync(OUT, { recursive: true });
const EXP = JSON.parse(fs.readFileSync(path.join(DATA, "expected.json"), "utf8"));
const results = []; const check = (n, ok, d = "") => { results.push({ name: n, ok: !!ok, detail: String(d).slice(0, 300) }); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  -> " + String(d).slice(0, 300)}`); };
async function upload(file, multi, design) {
  const body = { base64_content: fs.readFileSync(path.join(DATA, "datasets", file)).toString("base64"), file_type: "csv", genotype_column: "Genotype", rep_column: "rep",
    environment_column: multi ? "Env" : null, mode: multi ? "multi" : "single", design_type: design };
  const r = await fetch(`${API}/upload/dataset`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j)); return j.dataset_token;
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
async function open(query) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1800 } }); const page = await ctx.newPage();
  const errors = [], reqs = []; page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (rq) => { if (rq.method() === "POST" && rq.url().startsWith(API)) reqs.push({ url: rq.url(), mode: rq.headers()["x-vivasense-mode"], body: rq.postData() }); });
  await page.goto(`${UI}/e2e/index.html?${query}`); return { page, errors, reqs, close: () => ctx.close() };
}
const text = (p) => p.locator("body").innerText();
const BAD = /\b(NaN|Infinity|undefined|\[object Object\])\b/;

// 1. module grid: only PCA and Stability are launchable; banner exact
{
  const { page, errors, close } = await open("traits=Yield");
  await page.getByText("Advanced Analysis").first().waitFor({ timeout: 20000 }).catch(() => {});
  const t = await text(page);
  check("grid shows the exact experimental banner", t.includes("Experimental Beta — Scientific Validation in Progress."));
  const runs = await page.getByRole("button", { name: /Run Analysis — Experimental/ }).count();
  const off = await page.getByRole("button", { name: /Unavailable pending validation/ }).count();
  check("exactly 2 launchable modules (PCA, Stability) and 5 unavailable", runs === 2 && off === 5, `${runs}/${off}`);
  for (const b of await page.getByRole("button", { name: /Unavailable pending validation/ }).all()) { check("unavailable button is disabled", await b.isDisabled()); break; }
  for (const m of ["blup", "cluster", "path-analysis", "selection-index", "trait-association"]) {
    const p2 = await open(`traits=Yield&module=${m}`); await p2.page.waitForTimeout(800);
    check(`deep link to ${m} does not open the method`, !(await text(p2.page)).includes("Back to advanced modules")); await p2.close();
  }
  await page.screenshot({ path: `${OUT}/01_grid.png`, fullPage: true }); await close();
}
// 2. PCA against the real backend
{
  const tok = await upload("pca_12x4.csv", false, "rcbd");
  const { page, reqs, errors, close } = await open(`module=pca&token=${tok}&traits=T1,T2,T3,T4&mode=single`);
  await page.getByRole("button", { name: /Run PCA|Run Analysis|Run/ }).first().click();
  await page.getByText(/Interpretation \(descriptive\)/).first().waitFor({ timeout: 90000 });
  const t = await text(page);
  const pca = reqs.find((r) => r.url.endsWith("/analysis/pca"));
  check("PCA request carries X-VivaSense-Mode: pro", pca?.mode === "pro", JSON.stringify(pca?.mode));
  check("PCA request body: refuse-by-default exclusions", /"on_missing":"refuse"/.test(pca?.body ?? "") && /"on_zero_variance":"refuse"/.test(pca?.body ?? ""), pca?.body);
  check("PCA shows the verified-computation banner and descriptive interpretation", /verified|cross-checked|Numerically/i.test(t) && /descriptive/i.test(t));
  const pct = EXP.pca_12x4.explained_pct[0].toFixed(1);
  check(`PCA screen shows PC1 = ${pct}% (independent numpy value)`, t.includes(pct), t.slice(0, 200));
  check("PCA banner still shown on the opened method", t.includes("Experimental Beta — Scientific Validation in Progress."));
  check("PCA page: no NaN/Infinity/undefined and no page errors", !BAD.test(t) && errors.length === 0, errors.join(";") + (t.match(BAD) ?? ""));
  await page.screenshot({ path: `${OUT}/02_pca.png`, fullPage: true }); await close();
}
// 3. Stability / AMMI / GGE against the real backend
{
  const tok = await upload("met_rcbd_6x5x3.csv", true, "rcbd");
  const { page, reqs, errors, close } = await open(`module=stability&token=${tok}&traits=Yield`);
  await page.getByRole("button", { name: /Run Stability Analysis/ }).click();
  await page.getByRole("tab", { name: "Classic" }).waitFor({ timeout: 120000 });
  const st = reqs.find((r) => r.url.endsWith("/analysis/stability"));
  check("stability request carries the mode header and no exclusion authorisation by default", st?.mode === "pro" && !/exclude_invalid_observations/.test(st?.body ?? ""), JSON.stringify(st));
  const classic = await (async () => { await page.getByRole("tab", { name: "Classic" }).click(); await page.waitForTimeout(400); return text(page); })();
  check("Classic: exploratory flag + provisional notice + both slope tests", /Exploratory flag \(provisional\)/.test(classic) && /Provisional classification/i.test(classic) && /pooled SE/.test(classic));
  const pcells = (await page.locator("td").allInnerTexts()).map((s) => s.trim());
  check("Classic: pooled-SE p-values are numbers (not blank)", pcells.filter((s) => /^0\.\d{3}$|^1\.000$/.test(s)).length >= 6);
  check("Classic: no cell reads just 'stable' and no 'best stable' wording", !pcells.some((s) => /^stable$/i.test(s)) && !/best stable/i.test(classic));
  const b0 = EXP.met_rcbd_6x5x3.b[0].toFixed(3);
  check(`Classic shows b for G1 = ${b0} (independent value)`, classic.includes(b0), b0);
  const cmp = await (async () => { await page.getByRole("tab", { name: "Comparison" }).click(); await page.waitForTimeout(500); return text(page); })();
  check("Comparison: neutral ranking title, no 'Consensus', no-equivalence caution", /Exploratory combined stability rankings/.test(cmp) && !/consensus/i.test(cmp) && /No equivalence test was performed/.test(cmp));
  for (const tab of ["AMMI", "GGE"]) {
    await page.getByRole("tab", { name: new RegExp(tab) }).click().catch(() => {}); await page.waitForTimeout(600);
    const t = await text(page); check(`${tab} tab renders real results without NaN/Infinity`, t.length > 500 && !BAD.test(t), String(t.match(BAD)));
  }
  check("Stability page: banner present, no page errors", (await text(page)).includes("Experimental Beta — Scientific Validation in Progress.") && errors.length === 0, errors.join(";"));
  await page.screenshot({ path: `${OUT}/03_stability.png`, fullPage: true }); await close();
}
// 4. exact-fit data through the UI
{
  const tok = await upload("met_exact_linear_4x4x2.csv", true, "rcbd");
  const { page, close } = await open(`module=stability&token=${tok}&traits=Yield`);
  await page.getByRole("button", { name: /Run Stability Analysis/ }).click(); await page.getByRole("tab", { name: "Classic" }).waitFor({ timeout: 120000 });
  await page.getByRole("tab", { name: "Classic" }).click(); await page.waitForTimeout(400); const t = await text(page);
  check("exact fit: shown as 'exact fit: no test' with the deterministic-comparison label, never as a rejected test", /exact fit: no test/.test(t) && /no slope test performed/.test(t) && !/b_i = 1 and S2d_i = 0 not rejected/.test(t));
  await close();
}
await browser.close(); fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
const failed = results.filter((r) => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed`); process.exit(failed.length ? 1 : 0);
