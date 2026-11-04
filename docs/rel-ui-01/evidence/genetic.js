const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = process.argv[2], CSV = process.argv[3];
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('http://localhost:5173/.e2e-harness/index.html');
  await page.getByLabel('Upload relationship dataset').setInputFiles(CSV);
  await page.getByRole('button', { name: /Breeding & Genetic Relationships/ }).click();
  await page.getByLabel('Genotype / entry column').selectOption('Genotype');
  await page.getByLabel('Replication / Block column').selectOption('Rep');
  await page.getByLabel('Variable Yield').check(); await page.getByLabel('Variable Height').check();
  const decl = page.getByLabel(/I confirm that the entries being compared represent genetic materials/);
  await decl.check(); await page.getByLabel(/Experimental design/).selectOption('rcbd');
  const respP = page.waitForResponse(r => r.url().includes('/genetics/correlation'));
  await page.getByRole('button', { name: /Run Breeding & Genetic Relationships/ }).click();
  const resp = await respP; const body = await resp.json();
  const sentA = JSON.parse(resp.request().postData());
  await page.getByTestId('relationship-word-download').waitFor({ timeout: 120000 });
  const reqP = page.waitForRequest(r => r.url().includes('/export/correlation-word')); const dlP = page.waitForEvent('download');
  await page.getByTestId('relationship-word-download').click();
  const req = await reqP; const dl = await dlP; await dl.saveAs(path.join(OUT, 'genetic.docx'));
  const sent = req.postDataJSON();
  console.log(JSON.stringify({ analysis_status: resp.status(),
    analysis_request: { analysis_context: sentA.analysis_context, genetic_material_confirmed: sentA.genetic_material_confirmed, design: sentA.design, alpha: sentA.alpha },
    genotypic_status: body.genotypic_status, filename: dl.suggestedFilename(),
    payload_identical: JSON.stringify(sent) === JSON.stringify(body), page_errors: errors }, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
