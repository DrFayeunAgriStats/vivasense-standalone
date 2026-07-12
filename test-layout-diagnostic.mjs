import { chromium } from 'playwright';

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

    console.log('\nLoading /workspace...');
    await page.goto(`${BASE_URL}/workspace`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    console.log(`URL: ${page.url()}`);

    // Get page structure
    const structure = await page.evaluate(() => {
      return {
        title: document.title,
        body: {
          classes: document.body.className,
          children: Array.from(document.body.children).map(el => ({
            tag: el.tagName.toLowerCase(),
            classes: el.className,
            textContent: el.textContent?.substring(0, 100) || ''
          }))
        },
        hasHeader: !!document.querySelector('header'),
        hasMain: !!document.querySelector('main'),
        hasFooter: !!document.querySelector('footer'),
        headings: Array.from(document.querySelectorAll('h1, h2')).map(h => ({
          tag: h.tagName,
          text: h.textContent?.substring(0, 80) || ''
        }))
      };
    });

    console.log('\n📄 Page Structure:');
    console.log(`Title: ${structure.title}`);
    console.log(`Body classes: ${structure.body.classes || '(none)'}`);
    console.log(`\nDirect children of <body>:`);
    structure.body.children.forEach((child, i) => {
      console.log(`  [${i}] <${child.tag}>${child.classes ? ` class="${child.classes}"` : ''}`);
      if (child.textContent) console.log(`       "${child.textContent.substring(0, 60)}..."`);
    });

    console.log(`\n🏗️ Semantic tags:`);
    console.log(`  <header>: ${structure.hasHeader ? '✅' : '❌'}`);
    console.log(`  <main>: ${structure.hasMain ? '✅' : '❌'}`);
    console.log(`  <footer>: ${structure.hasFooter ? '✅' : '❌'}`);

    if (structure.headings.length > 0) {
      console.log(`\n📖 Headings found:`);
      structure.headings.forEach(h => {
        console.log(`  <${h.tag}>: ${h.text}`);
      });
    }

    console.log('\n✅ Diagnostic complete');

    await context.close();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

test();
