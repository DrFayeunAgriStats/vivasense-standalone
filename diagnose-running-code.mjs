import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

async function test() {
  let browser;
  try {
    console.log('⏳ Connecting to running app...');
    browser = await chromium.launch({ headless: true })
      .catch(() => chromium.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      }));

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('Loading /workspace...');
    await page.goto(`${BASE_URL}/workspace`, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for content to render
    await page.waitForTimeout(3000);

    const pageInfo = await page.evaluate(() => {
      // Get all styles applied to body
      const bodyStyles = window.getComputedStyle(document.body);

      return {
        bodyClasses: document.body.className,
        bodyOuterHTML: document.body.outerHTML.substring(0, 800),
        hasLayoutComponent: document.body.innerHTML.includes('Layout'),
        hasHeaderTag: !!document.querySelector('header'),
        hasMainTag: !!document.querySelector('main'),
        hasFooterTag: !!document.querySelector('footer'),
        hasContainerWide: document.body.innerHTML.includes('container-wide'),
        bodyBackgroundColor: bodyStyles.backgroundColor,
        bodyFontFamily: bodyStyles.fontFamily,
        allText: document.body.innerText.substring(0, 500),
        mainDivClasses: document.querySelector('div')?.className || '(no div)',
      };
    });

    console.log('\n📊 RUNNING CODE ANALYSIS:');
    console.log('='.repeat(70));

    console.log('\n1. Semantic HTML Tags:');
    console.log(`   <header>: ${pageInfo.hasHeaderTag ? '✅ PRESENT' : '❌ MISSING'}`);
    console.log(`   <main>: ${pageInfo.hasMainTag ? '✅ PRESENT' : '❌ MISSING'}`);
    console.log(`   <footer>: ${pageInfo.hasFooterTag ? '✅ PRESENT' : '❌ MISSING'}`);

    console.log('\n2. Layout Components:');
    console.log(`   Layout wrapper: ${pageInfo.hasLayoutComponent ? '✅ FOUND' : '❌ NOT FOUND'}`);
    console.log(`   container-wide class: ${pageInfo.hasContainerWide ? '✅ FOUND' : '❌ NOT FOUND'}`);

    console.log('\n3. Body Element:');
    console.log(`   Classes: "${pageInfo.bodyClasses || '(none)'}"`);
    console.log(`   First div classes: "${pageInfo.mainDivClasses}"`);

    console.log('\n4. Page Content (first 200 chars):');
    console.log(`   ${pageInfo.allText.substring(0, 200)}`);

    console.log('\n5. CSS Info:');
    console.log(`   Body background: ${pageInfo.bodyBackgroundColor}`);
    console.log(`   Font family: ${pageInfo.bodyFontFamily}`);

    console.log('\n6. Full body HTML (first 800 chars):');
    console.log(pageInfo.bodyOuterHTML.substring(0, 800));

    console.log('\n' + '='.repeat(70));
    if (!pageInfo.hasHeaderTag && !pageInfo.hasMainTag && !pageInfo.hasFooterTag) {
      console.log('❌ DIAGNOSIS: Layout structure is NOT rendering');
      console.log('\nPossible causes:');
      console.log('1. Dev server is serving cached/stale code from before Phase 8');
      console.log('2. Phase 8 commit exists in git but build did not pick it up');
      console.log('3. Layout wrapper exists in code but is not being rendered');
      console.log('4. Build/dev-server needs restart');
    } else {
      console.log('✅ DIAGNOSIS: Layout structure IS rendering correctly');
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
