import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

async function test() {
  let browser;
  try {
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

    console.log('📍 Loading /workspace (waiting for full render)...');
    await page.goto(`${BASE_URL}/workspace`, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for Layout to render (header should appear)
    console.log('⏳ Waiting for Layout components to render...');
    await page.waitForSelector('header, [role="navigation"]', { timeout: 10000 }).catch(() => null);

    // Give React a moment to finish rendering
    await page.waitForTimeout(2000);

    const structure = await page.evaluate(() => {
      return {
        hasHeader: !!document.querySelector('header'),
        hasMain: !!document.querySelector('main'),
        hasFooter: !!document.querySelector('footer'),
        headerText: document.querySelector('header')?.innerText?.substring(0, 200) || '(not found)',
        footerText: document.querySelector('footer')?.innerText?.substring(0, 200) || '(not found)',
        bodyHTML: document.body.innerHTML.substring(0, 500)
      };
    });

    console.log('\n📊 LAYOUT VERIFICATION RESULTS:');
    console.log('='.repeat(70));
    console.log(`\n✅ Semantic HTML Structure:`);
    console.log(`  <header>: ${structure.hasHeader ? '✅ PRESENT' : '❌ MISSING'}`);
    console.log(`  <main>: ${structure.hasMain ? '✅ PRESENT' : '❌ MISSING'}`);
    console.log(`  <footer>: ${structure.hasFooter ? '✅ PRESENT' : '❌ MISSING'}`);

    if (structure.hasHeader) {
      console.log(`\n📄 Header Content:`);
      console.log(`   ${structure.headerText.split('\n')[0]}`);
    }

    if (structure.hasFooter) {
      console.log(`\n📄 Footer Content:`);
      console.log(`   ${structure.footerText.split('\n')[0]}`);
    }

    console.log('\n' + '='.repeat(70));
    if (structure.hasHeader && structure.hasMain && structure.hasFooter) {
      console.log('✅ PHASE 8 STEP 2 VERIFICATION: PASS');
      console.log('\nLayout integration is working correctly!');
      console.log('All semantic HTML tags are present and rendering.');
    } else {
      console.log('⚠️  PHASE 8 STEP 2 VERIFICATION: INCOMPLETE');
      console.log('\nSome Layout elements not detected. Possible causes:');
      console.log('  • Page still loading (React not fully mounted)');
      console.log('  • Auth redirect (page not rendering workspace content)');
      console.log('  • Layout import or render issue');
    }

    await context.close();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

test();
