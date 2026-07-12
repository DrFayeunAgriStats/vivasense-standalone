import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';

async function test() {
  let browser;
  try {
    console.log('🔍 Diagnostic Test - Checking App State\n');

    // Wait for server
    console.log('⏳ Waiting for server...');
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(BASE_URL);
        if (res.ok || res.status === 401) break;
      } catch (e) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    console.log('✅ Server ready\n');

    browser = await chromium.launch({ headless: true })
      .catch(() => chromium.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      }));

    const context = await browser.newContext();
    const page = await context.newPage();

    // Go to home
    console.log('📍 Loading home page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    const url = page.url();
    console.log(`   URL: ${url}`);

    // Get page title and main headings
    const title = await page.title();
    console.log(`   Title: ${title}`);

    const h1Count = await page.locator('h1').count();
    const h2Count = await page.locator('h2').count();
    console.log(`   H1 headings: ${h1Count}`);
    console.log(`   H2 headings: ${h2Count}`);

    // Get all text content for analysis
    const allText = await page.locator('body').innerText();
    const textLines = allText.split('\n').filter(l => l.trim()).slice(0, 30);

    console.log('\n   📄 Page content (first 30 lines):');
    textLines.forEach((line, i) => {
      console.log(`      ${i + 1}. ${line.substring(0, 100)}`);
    });

    // Check for specific elements
    console.log('\n🔎 Element checks:');
    const authLink = await page.locator('text=/Sign in|Log in|Login/i').count();
    const authBtn = await page.locator('button:has-text(/Sign in|Log in|Login/i)').count();
    const workspaceLink = await page.locator('text=/Workspace|workspace/').count();
    const analysisLink = await page.locator('text=/Analysis|analysis/').count();

    console.log(`   Auth links: ${authLink}`);
    console.log(`   Auth buttons: ${authBtn}`);
    console.log(`   Workspace references: ${workspaceLink}`);
    console.log(`   Analysis references: ${analysisLink}`);

    // Try navigating directly to /workspace
    console.log('\n📍 Attempting /workspace navigation...');
    await page.goto(`${BASE_URL}/workspace`, { waitUntil: 'networkidle', timeout: 30000 });
    const wsUrl = page.url();
    console.log(`   URL after /workspace: ${wsUrl}`);

    const wsTitle = await page.title();
    console.log(`   Title: ${wsTitle}`);

    const wsText = await page.locator('body').innerText();
    const wsLines = wsText.split('\n').filter(l => l.trim()).slice(0, 40);

    console.log('\n   📄 /workspace content (first 40 lines):');
    wsLines.forEach((line, i) => {
      console.log(`      ${i + 1}. ${line.substring(0, 100)}`);
    });

    // Save full HTML for inspection
    const html = await page.content();
    fs.writeFileSync('workspace-page.html', html);
    console.log('\n✅ Full workspace HTML saved to: workspace-page.html');

    await context.close();
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

test().catch(console.error);
