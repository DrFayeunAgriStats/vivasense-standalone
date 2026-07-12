import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';

async function test() {
  let browser;
  try {
    console.log('Waiting for server...');
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(BASE_URL);
        if (res.ok || res.status === 401) break;
      } catch (e) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    browser = await chromium.launch({ headless: true })
      .catch(() => chromium.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      }));

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Loading home page...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Get full page screenshot
    await page.screenshot({ path: 'current-ui-home.png', fullPage: true });
    console.log('✅ Saved: current-ui-home.png');

    // Get page structure analysis
    const structure = await page.evaluate(() => {
      return {
        title: document.title,
        hasHeader: !!document.querySelector('header'),
        hasSidebar: !!document.querySelector('[role="navigation"], .sidebar, [class*="sidebar"]'),
        hasFooter: !!document.querySelector('footer'),
        headerContent: document.querySelector('header')?.innerText || 'none',
        bodyClasses: document.body.className,
        mainContent: document.querySelector('main')?.className || 'no main tag',
        gridLayout: window.getComputedStyle(document.body).display
      };
    });

    console.log('\nPage Structure:');
    console.log(JSON.stringify(structure, null, 2));

    fs.writeFileSync('ui-structure.json', JSON.stringify(structure, null, 2));

    await context.close();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

test();
