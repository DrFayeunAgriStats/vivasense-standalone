import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const RESULTS = {
  timestamp: new Date().toISOString(),
  endpoints: {},
  errors: []
};

async function waitForServer(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok || res.status === 401) return true;
    } catch (e) {
      console.log(`⏳ Attempt ${i + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Server not ready');
}

async function test() {
  console.log('Starting endpoint verification...\n');

  let browser;
  try {
    console.log('⏳ Waiting for server...');
    await waitForServer();
    console.log('✅ Server ready\n');

    // Launch without downloading missing browsers - use system chromium
    console.log('🔧 Launching browser...');
    browser = await chromium.launch({
      headless: true,
      // Try to use system chromium if available
      executablePath: process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/chromium-browser'
    }).catch(() => chromium.launch({ headless: true }));

    const context = await browser.newContext();
    const page = await context.newPage();

    // Log all network requests
    const networkLog = [];
    page.on('request', req => {
      if (req.url().includes('/analysis/')) {
        networkLog.push({
          type: 'request',
          time: new Date().toISOString(),
          method: req.method(),
          url: req.url(),
          postData: req.postDataJSON ? req.postDataJSON() : null
        });
      }
    });

    page.on('response', async res => {
      if (res.url().includes('/analysis/')) {
        try {
          const body = await res.json();
          networkLog.push({
            type: 'response',
            time: new Date().toISOString(),
            url: res.url(),
            status: res.status(),
            ok: res.ok(),
            body: body
          });
        } catch (e) {
          networkLog.push({
            type: 'response',
            time: new Date().toISOString(),
            url: res.url(),
            status: res.status(),
            ok: res.ok(),
            body: '(non-JSON response)'
          });
        }
      }
    });

    // Navigate to app
    console.log('📍 Navigating to app...');
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log(`✅ Loaded: ${page.url()}\n`);
    } catch (e) {
      console.log(`⚠️  Navigation issue: ${e.message}`);
    }

    // Check for analysis panels
    console.log('📋 Checking UI elements...');
    const pcaText = await page.locator('text=/PCA|Principal Component/i').count();
    const clusterText = await page.locator('text=/Cluster/i').count();
    const pathText = await page.locator('text=/Path Analysis|path-analysis/i').count();

    console.log(`   PCA panel: ${pcaText > 0 ? '✅ found' : '❌ not found'}`);
    console.log(`   Cluster panel: ${clusterText > 0 ? '✅ found' : '❌ not found'}`);
    console.log(`   Path Analysis panel: ${pathText > 0 ? '✅ found' : '❌ not found'}\n`);

    RESULTS.panelDetection = {
      pca: pcaText > 0,
      cluster: clusterText > 0,
      pathAnalysis: pathText > 0
    };

    // Check page HTML for component imports
    console.log('🔍 Checking component presence in page HTML...');
    const pageHtml = await page.content();

    const hasPcaPanel = pageHtml.includes('PcaPanel') || pageHtml.includes('PCA');
    const hasClusterPanel = pageHtml.includes('ClusterPanel') || pageHtml.includes('Cluster');
    const hasPathAnalysisPanel = pageHtml.includes('PathAnalysisPanel') || pageHtml.includes('Path');

    console.log(`   PcaPanel in HTML: ${hasPcaPanel ? '✅' : '❌'}`);
    console.log(`   ClusterPanel in HTML: ${hasClusterPanel ? '✅' : '❌'}`);
    console.log(`   PathAnalysisPanel in HTML: ${hasPathAnalysisPanel ? '✅' : '❌'}\n`);

    RESULTS.componentDetection = {
      pcaPanel: hasPcaPanel,
      clusterPanel: hasClusterPanel,
      pathAnalysisPanel: hasPathAnalysisPanel
    };

    // Look for Run buttons
    console.log('🔘 Checking for Run buttons...');
    const runButtons = await page.locator('button:has-text("Run"), button[aria-label*="Run"]').count();
    console.log(`   Run buttons found: ${runButtons}\n`);

    RESULTS.runButtons = runButtons;

    // Check for API functions in the page
    console.log('📡 Checking for API integration...');

    // Wait a moment for network activity
    await page.waitForTimeout(2000);

    console.log(`   Network calls to /analysis/ endpoints: ${networkLog.filter(l => l.type === 'request').length}`);
    console.log(`   Network responses from /analysis/ endpoints: ${networkLog.filter(l => l.type === 'response').length}\n`);

    RESULTS.networkActivity = {
      requests: networkLog.filter(l => l.type === 'request').length,
      responses: networkLog.filter(l => l.type === 'response').length,
      log: networkLog
    };

    // Summary
    console.log('='.repeat(60));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Application is running and accessible`);
    console.log(`${hasPcaPanel ? '✅' : '⚠️'} PCA module present`);
    console.log(`${hasClusterPanel ? '✅' : '⚠️'} Cluster module present`);
    console.log(`${hasPathAnalysisPanel ? '✅' : '⚠️'} Path Analysis module present`);
    console.log(`${runButtons > 0 ? '✅' : '⚠️'} Analysis execution buttons available`);

    console.log('\n📄 Detailed network log (first 5 interactions):');
    networkLog.slice(0, 5).forEach((log, i) => {
      console.log(`\n  [${i + 1}] ${log.type.toUpperCase()}`);
      console.log(`      Time: ${log.time}`);
      console.log(`      URL: ${log.url}`);
      if (log.method) console.log(`      Method: ${log.method}`);
      if (log.status !== undefined) console.log(`      Status: ${log.status}`);
    });

    // Write detailed results
    fs.writeFileSync('endpoint-verification-results.json', JSON.stringify(RESULTS, null, 2));
    console.log('\n✅ Full results saved to endpoint-verification-results.json');

    await context.close();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    RESULTS.error = error.message;
    fs.writeFileSync('endpoint-verification-results.json', JSON.stringify(RESULTS, null, 2));
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

test();
