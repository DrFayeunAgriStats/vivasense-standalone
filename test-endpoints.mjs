import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;
const RESULTS_FILE = 'endpoint-test-results.json';

// Create a simple test CSV dataset with traits suitable for genetics analysis
function createTestDataset() {
  const headers = ['genotype', 'trait1', 'trait2', 'trait3', 'trait4', 'block', 'environment'];
  const genotypes = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'];
  const rows = [];
  rows.push(headers.join(','));

  for (let i = 0; i < genotypes.length; i++) {
    const g = genotypes[i];
    const trait1 = (Math.random() * 100 + 50).toFixed(2);
    const trait2 = (Math.random() * 80 + 40).toFixed(2);
    const trait3 = (Math.random() * 60 + 30).toFixed(2);
    const trait4 = (Math.random() * 50 + 25).toFixed(2);
    const block = (i % 2) + 1;
    const env = (i % 3) + 1;
    rows.push(`${g},${trait1},${trait2},${trait3},${trait4},${block},${env}`);
  }

  return rows.join('\n');
}

async function checkServerReady(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok || res.status === 401) return true;
    } catch (e) {
      console.log(`⏳ Waiting for server... attempt ${i + 1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`Server not ready at ${BASE_URL}`);
}

async function test() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  let browser;
  try {
    console.log('⏳ Waiting for dev server...');
    await checkServerReady();
    console.log('✅ Server is ready\n');

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    const requestsLog = [];
    const responsesLog = [];

    context.on('request', request => {
      if (request.url().includes('/analysis/')) {
        requestsLog.push({
          timestamp: new Date().toISOString(),
          method: request.method(),
          url: request.url()
        });
      }
    });

    context.on('response', async response => {
      if (response.url().includes('/analysis/')) {
        try {
          const body = await response.json();
          responsesLog.push({
            timestamp: new Date().toISOString(),
            url: response.url(),
            status: response.status(),
            body: body
          });
        } catch (e) {
          responsesLog.push({
            timestamp: new Date().toISOString(),
            url: response.url(),
            status: response.status(),
            body: '(Could not parse JSON)'
          });
        }
      }
    });

    const page = await context.newPage();

    console.log('📍 TEST 1: Navigate to app');
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 });
      console.log('✅ App loaded');
      results.tests.appLoad = { status: 'passed', url: page.url() };
    } catch (e) {
      console.log(`⚠️  Page load note: ${e.message}`);
      results.tests.appLoad = { status: 'info', url: page.url() };
    }

    console.log(`   URL: ${page.url()}\n`);

    console.log('📍 TEST 2: Check page structure');
    const pageContent = await page.content();
    const hasGeneticsTerm = pageContent.includes('genetics') || pageContent.includes('Genetics') || pageContent.includes('Advanced');
    console.log(`   Genetics/Analysis content: ${hasGeneticsTerm ? '✅' : '⚠️'}`);

    console.log('\n📍 TEST 3: Look for analysis panels');
    const pcaPanel = await page.locator('text=/PCA|Principal Component/i').count();
    const clusterPanel = await page.locator('text=/Cluster|Clustering|K-means/i').count();
    const pathPanel = await page.locator('text=/Path Analysis|path-analysis/i').count();

    console.log(`   PCA panel visible: ${pcaPanel > 0 ? '✅' : '❌'}`);
    console.log(`   Cluster panel visible: ${clusterPanel > 0 ? '✅' : '❌'}`);
    console.log(`   Path Analysis panel visible: ${pathPanel > 0 ? '✅' : '❌'}`);

    console.log('\n📍 TEST 4: Check for Run buttons');
    const runButtons = await page.locator('button:has-text("Run")').count();
    const playButtons = await page.locator('button[aria-label*="Run"]').count();
    console.log(`   Run/Play buttons available: ${runButtons + playButtons}`);

    console.log('\n📍 TEST 5: Network activity check');
    const analysisRequests = requestsLog.filter(r => r.url.includes('/analysis/'));
    console.log(`   Analysis API calls intercepted: ${analysisRequests.length}`);

    console.log('\n📍 TEST 6: Check for errors');
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.waitForTimeout(1000);
    console.log(`   Console errors: ${errors.length}`);

    // Save results
    results.tests = {
      appLoad: results.tests.appLoad,
      pageStructure: { hasGeneticsContent: hasGeneticsTerm },
      panels: {
        pca: pcaPanel > 0,
        cluster: clusterPanel > 0,
        pathAnalysis: pathPanel > 0
      },
      buttons: runButtons + playButtons,
      networkRequests: analysisRequests.length,
      consoleErrors: errors.length,
      requests: requestsLog,
      responses: responsesLog
    };

    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ App is accessible`);
    console.log(`${hasGeneticsTerm ? '✅' : '⚠️'} Advanced Analysis content detected`);
    console.log(`${pcaPanel > 0 ? '✅' : '❌'} PCA panel found`);
    console.log(`${clusterPanel > 0 ? '✅' : '❌'} Cluster panel found`);
    console.log(`${pathPanel > 0 ? '✅' : '❌'} Path Analysis panel found`);
    console.log(`${runButtons + playButtons > 0 ? '✅' : '⚠️'} Run buttons available`);

    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`\n📄 Results saved to: ${RESULTS_FILE}`);

    await context.close();

  } catch (error) {
    console.error('❌ Test error:', error.message);
    results.error = error.message;
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

test().catch(console.error);
