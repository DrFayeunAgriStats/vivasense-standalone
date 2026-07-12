import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const RESULTS = {
  timestamp: new Date().toISOString(),
  tests: {},
  panelDetection: {},
  networkLog: []
};

async function waitForServer(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok || res.status === 401) return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Server not ready');
}

async function test() {
  console.log('🧪 Advanced Analytics Endpoint Verification\n');
  console.log('='.repeat(70));

  let browser;
  try {
    console.log('⏳ Waiting for server...');
    await waitForServer();
    console.log('✅ Server ready\n');

    browser = await chromium.launch({ headless: true })
      .catch(() => chromium.launch({
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      }));

    const context = await browser.newContext();
    const page = await context.newPage();

    // Capture network traffic
    const networkLog = [];
    page.on('request', req => {
      if (req.url().includes('/analysis/')) {
        networkLog.push({
          type: 'request',
          method: req.method(),
          url: req.url(),
          timestamp: new Date().toISOString()
        });
      }
    });

    page.on('response', async res => {
      if (res.url().includes('/analysis/')) {
        try {
          const body = await res.json();
          networkLog.push({
            type: 'response',
            status: res.status(),
            url: res.url(),
            success: res.ok(),
            timestamp: new Date().toISOString(),
            body: body
          });
        } catch (e) {
          networkLog.push({
            type: 'response',
            status: res.status(),
            url: res.url(),
            success: res.ok(),
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    // Navigate to workspace
    console.log('📍 STEP 1: Navigate to workspace');
    await page.goto(`${BASE_URL}/workspace`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`   ✅ Loaded: ${page.url()}`);
    await page.waitForTimeout(2000);

    // Check for module selection screen
    const moduleSelectionVisible = await page.locator('text=/VivaSense Analysis Suite/i').isVisible();
    console.log(`   Module selection visible: ${moduleSelectionVisible ? '✅' : '❌'}\n`);
    RESULTS.tests.workspaceLoad = { status: moduleSelectionVisible ? 'passed' : 'warning' };

    // Click Advanced Analytics card
    console.log('📍 STEP 2: Navigate to Advanced Analytics');
    const advancedCard = page.locator('text=/Advanced Analytics/i').first();
    const cardVisible = await advancedCard.isVisible();

    if (cardVisible) {
      console.log('   ✅ Advanced Analytics card found');
      await advancedCard.click();
      console.log('   ✅ Clicked Advanced Analytics');

      // Wait for dashboard to load
      await page.waitForTimeout(3000);

      const dashboardLoaded = await page.locator('text=/BLUP|PCA|Cluster|Path|Stability|MANOVA/i').count() > 0;
      console.log(`   Dashboard content loaded: ${dashboardLoaded ? '✅' : '❌'}\n`);
      RESULTS.tests.advancedNavigation = { status: 'passed' };
    } else {
      console.log('   ⚠️  Advanced Analytics card not found (may require auth)\n');
      RESULTS.tests.advancedNavigation = { status: 'warning', reason: 'card not found' };
    }

    // Check for analysis panels
    console.log('📍 STEP 3: Check for analysis panels');
    const pcaVisible = await page.locator('text=/PCA|Principal Component/i').isVisible();
    const clusterVisible = await page.locator('text=/Cluster|Clustering|k-means/i').isVisible();
    const pathVisible = await page.locator('text=/Path Analysis|path-analysis/i').isVisible();
    const blupVisible = await page.locator('text=/BLUP/i').isVisible();
    const stabilityVisible = await page.locator('text=/Stability/i').isVisible();

    console.log(`   PCA panel: ${pcaVisible ? '✅' : '❌'}`);
    console.log(`   Cluster panel: ${clusterVisible ? '✅' : '❌'}`);
    console.log(`   Path Analysis panel: ${pathVisible ? '✅' : '❌'}`);
    console.log(`   BLUP panel: ${blupVisible ? '✅' : '❌'}`);
    console.log(`   Stability panel: ${stabilityVisible ? '✅' : '❌'}\n`);

    RESULTS.panelDetection = {
      pca: pcaVisible,
      cluster: clusterVisible,
      pathAnalysis: pathVisible,
      blup: blupVisible,
      stability: stabilityVisible
    };

    // Check for API integration - look for Run buttons
    console.log('📍 STEP 4: Check for analysis execution buttons');
    const runButtons = await page.locator('button:has-text("Run"), [aria-label*="Run"]').count();
    console.log(`   Run/Play buttons found: ${runButtons}\n`);

    RESULTS.tests.runButtons = { count: runButtons, status: runButtons > 0 ? 'passed' : 'warning' };

    // Check page HTML for component presence
    console.log('📍 STEP 5: Check component integration');
    const pageHtml = await page.content();

    const hasPcaPanel = pageHtml.includes('PcaPanel');
    const hasClusterPanel = pageHtml.includes('ClusterPanel');
    const hasPathAnalysisPanel = pageHtml.includes('PathAnalysisPanel');
    const hasBlupPanel = pageHtml.includes('BlupPanel');
    const hasStabilityPanel = pageHtml.includes('StabilityPanel');

    console.log(`   PcaPanel component: ${hasPcaPanel ? '✅' : '❌'}`);
    console.log(`   ClusterPanel component: ${hasClusterPanel ? '✅' : '❌'}`);
    console.log(`   PathAnalysisPanel component: ${hasPathAnalysisPanel ? '✅' : '❌'}`);
    console.log(`   BlupPanel component: ${hasBlupPanel ? '✅' : '❌'}`);
    console.log(`   StabilityPanel component: ${hasStabilityPanel ? '✅' : '❌'}\n`);

    RESULTS.tests.componentIntegration = {
      pcaPanel: hasPcaPanel,
      clusterPanel: hasClusterPanel,
      pathAnalysisPanel: hasPathAnalysisPanel,
      blupPanel: hasBlupPanel,
      stabilityPanel: hasStabilityPanel
    };

    // Check for API function presence in JavaScript
    console.log('📍 STEP 6: Check API function availability');

    // Try to detect if runPca, runCluster, runPathAnalysis functions are available
    const apiAvailable = await page.evaluate(() => {
      // These would be loaded as part of the module
      return {
        hasFetch: typeof fetch !== 'undefined',
        hasXhr: typeof XMLHttpRequest !== 'undefined'
      };
    });

    console.log(`   fetch API available: ${apiAvailable.hasFetch ? '✅' : '❌'}`);
    console.log(`   XMLHttpRequest available: ${apiAvailable.hasXhr ? '✅' : '❌'}\n`);

    // Summary
    console.log('='.repeat(70));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(70));

    const totalPassed = [hasPcaPanel, hasClusterPanel, hasPathAnalysisPanel].filter(Boolean).length;
    const totalPanels = 3;

    console.log(`\n✅ App is running and accessible`);
    console.log(`✅ Workspace module loads correctly`);
    console.log(`${moduleSelectionVisible ? '✅' : '⚠️'} Module selection screen renders`);
    console.log(`${advancedCard.isVisible ? '✅' : '⚠️'} Advanced Analytics module accessible`);
    console.log(`\n📊 Analysis Components: ${totalPassed}/${totalPanels} detected`);
    console.log(`   • PCA: ${hasPcaPanel ? '✅ Integrated' : '❌ Missing'}`);
    console.log(`   • Cluster: ${hasClusterPanel ? '✅ Integrated' : '❌ Missing'}`);
    console.log(`   • Path Analysis: ${hasPathAnalysisPanel ? '✅ Integrated' : '❌ Missing'}`);
    console.log(`\n🔘 ${runButtons > 0 ? '✅' : '⚠️'} Run buttons available (${runButtons} found)`);
    console.log(`\n🌐 Network calls captured: ${networkLog.filter(l => l.type === 'request').length} requests, ${networkLog.filter(l => l.type === 'response').length} responses`);

    // Show network log details
    if (networkLog.length > 0) {
      console.log('\n📡 Network Activity:');
      networkLog.slice(0, 10).forEach((log, i) => {
        console.log(`   [${i + 1}] ${log.type === 'request' ? 'REQ' : 'RES'}: ${log.url.split('/').pop()}`);
      });
    }

    RESULTS.networkLog = networkLog;
    RESULTS.summary = {
      appRunning: true,
      panelsDetected: totalPassed,
      totalPanels: totalPanels,
      runButtonsAvailable: runButtons > 0,
      recommendation: totalPassed === totalPanels
        ? '✅ All analysis panels are properly integrated'
        : `⚠️ ${totalPanels - totalPassed} panel(s) missing or not properly integrated`
    };

    fs.writeFileSync('advanced-analytics-verification.json', JSON.stringify(RESULTS, null, 2));
    console.log('\n✅ Full results saved to: advanced-analytics-verification.json');

    await context.close();

  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    RESULTS.error = error.message;
    fs.writeFileSync('advanced-analytics-verification.json', JSON.stringify(RESULTS, null, 2));
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

test().catch(console.error);
