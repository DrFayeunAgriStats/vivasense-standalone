const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const OUT = process.argv[2]; const CSV = process.argv[3];
const URL_ = 'http://localhost:5173/.e2e-harness/index.html';
const results = [];
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

async function setup(browser, { method = 'pearson', alpha = '0.05', traits = ['Yield', 'Height', 'Days'] } = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(URL_);
  await page.getByLabel('Upload relationship dataset').setInputFiles(CSV);
  for (const t of traits) await page.getByLabel(`Variable ${t}`).check();
  if (method !== 'pearson') {
    const sel = page.locator('select').filter({ has: page.locator('option[value="spearman"]') }).first();
    await sel.selectOption('spearman');
  }
  await page.getByLabel('Significance level').selectOption(alpha);
  return { ctx, page, errors };
}

async function run(page) {
  const respP = page.waitForResponse(r => r.url().includes('/genetics/correlation') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /Run General Correlation/ }).click();
  const resp = await respP;
  const body = await resp.json();
  await page.getByTestId('relationship-word-download').waitFor();
  return { status: resp.status(), body };
}

async function displayed(page) {
  return await page.locator('section[aria-label="Relationship analysis results"]').innerText();
}

(async () => {
  const browser = await chromium.launch();
  // S1/S2: real General, real export, real DOCX
  for (const [name, opts] of [['general_pearson_a005', {}], ['general_spearman_a010', { method: 'spearman', alpha: '0.1' }]]) {
    const { ctx, page, errors } = await setup(browser, opts);
    const { status, body } = await run(page);
    const exportReq = page.waitForRequest(r => r.url().includes('/export/correlation-word'));
    const dl = page.waitForEvent('download');
    await page.getByTestId('relationship-word-download').click();
    const req = await exportReq; const d = await dl;
    const sent = req.postDataJSON();
    const file = path.join(OUT, `${name}.docx`); await d.saveAs(file);
    fs.writeFileSync(path.join(OUT, `${name}.response.json`), JSON.stringify(body, null, 1));
    fs.writeFileSync(path.join(OUT, `${name}.sent.json`), JSON.stringify(sent, null, 1));
    fs.writeFileSync(path.join(OUT, `${name}.displayed.txt`), await displayed(page));
    results.push({ name, analysis_status: status, suggested_filename: d.suggestedFilename(),
      mode_header: req.headers()['x-vivasense-mode'] || null,
      seal_identical: deepEq(sent.result_integrity, body.result_integrity),
      payload_identical: deepEq(sent, body), error_shown: await page.getByTestId('relationship-word-error').count(),
      page_errors: errors });
    await ctx.close();
  }
  // S3: missing seal (response stripped in the browser) — no export request may be issued
  {
    const { ctx, page } = await setup(browser);
    await page.route('**/genetics/correlation', async route => {
      const r = await route.fetch(); const j = await r.json(); delete j.result_integrity;
      await route.fulfill({ response: r, json: j });
    });
    let exportCalls = 0; page.on('request', r => { if (r.url().includes('/export/correlation-word')) exportCalls++; });
    await run(page);
    const btn = page.getByTestId('relationship-word-download');
    results.push({ name: 'missing_seal', button_disabled: await btn.isDisabled(),
      unavailable_msg: (await page.getByTestId('relationship-word-unavailable').innerText().catch(() => null)),
      export_calls: exportCalls });
    await ctx.close();
  }
  // S4..S6: tampered payload reaches the REAL backend, which must refuse
  const tampers = {
    tampered_r: j => { j.pair_results[0].r = 0.99; },
    tampered_p_adjusted: j => { j.pair_results[0].p_adjusted = 0.0001; },
    tampered_warnings: j => { j.warnings = []; },
    tampered_context: j => { j.analysis_context = 'genetic'; },
  };
  for (const [name, fn] of Object.entries(tampers)) {
    const { ctx, page } = await setup(browser);
    await run(page);
    let backendStatus = null; let downloads = 0;
    page.on('download', () => downloads++);
    await page.route('**/export/correlation-word', async route => {
      const j = route.request().postDataJSON(); fn(j);
      const r = await route.fetch({ postData: JSON.stringify(j) }); backendStatus = r.status();
      await route.fulfill({ response: r });
    });
    await page.getByTestId('relationship-word-download').click();
    await page.getByTestId('relationship-word-error').waitFor({ timeout: 60000 });
    results.push({ name, backend_status: backendStatus, downloads,
      error_text: await page.getByTestId('relationship-word-error').innerText(),
      heading: await page.getByText('The Word report was not generated').count() });
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'browser_results.json'), JSON.stringify(results, null, 1));
  console.log(JSON.stringify(results, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
