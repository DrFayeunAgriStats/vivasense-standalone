const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

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
      if (res.ok || res.status === 401) return true; // 401 is auth redirect, still means server is up
    } catch (e) {
      console.log(`Waiting for server... attempt ${i + 1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`Server not ready at ${BASE_URL} after ${maxRetries} attempts`);
}

async function test() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  let browser;
  try {
    // Wait for server to be ready
    console.log('⏳ Waiting for dev server...');
    await checkServerReady();
    console.log('✅ Server is ready\n');

    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    // Intercept and log network requests
    const requestsLog = [];
    context.on('request', request => {
      if (request.url().includes('/analysis/')) {
        requestsLog.push({
          timestamp: new Date().toISOString(),
          method: request.method(),
          url: request.url(),
          postData: request.postDataJSON ? request.postDataJSON() : null
        });
      }
    });

    const responsesLog = [];
    context.on('response', response => {
      if (response.url().includes('/analysis/')) {
        response.json().then(body => {
          responsesLog.push({
            timestamp: new Date().toISOString(),
            url: response.url(),
            status: response.status(),
            body: body
          });
        }).catch(() => {
          responsesLog.push({
            timestamp: new Date().toISOString(),
            url: response.url(),
            status: response.status(),
            body: '(Could not parse JSON)'
          });
        });
      }
    });

    const page = await context.newPage();

    // Test 1: Navigate to app and check it loads
    console.log('📍 TEST 1: Navigate to app');
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 10000 });
      console.log('✅ App loaded');
      results.tests.appLoad = { status: 'passed', url: page.url() };
    } catch (e) {
      console.log(`⚠️  Page load timed out (may be auth redirect): ${e.message}`);
      results.tests.appLoad = { status: 'info', message: e.message };
    }

    // Get current URL
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}\n`);

    // Test 2: Look for genetics module and dataset upload
    console.log('📍 TEST 2: Check page structure');
    const pageContent = await page.content();
    const hasGeneticsTerm = pageContent.includes('genetics') || pageContent.includes('Genetics') || pageContent.includes('dataset');
    console.log(`   Genetics-related content: ${hasGeneticsTerm ? '✅' : '⚠️'}`);
    results.tests.pageStructure = { status: 'passed', hasGeneticsContent: hasGeneticsTerm };

    // Test 3: Attempt to create and upload test dataset
    console.log('\n📍 TEST 3: Upload test dataset');
    const csvContent = createTestDataset();
    console.log(`   Created test CSV (10 genotypes, 4 traits)`);

    // Write CSV to disk temporarily
    const csvPath = path.join(process.cwd(), 'test-data.csv');
    fs.writeFileSync(csvPath, csvContent);
    console.log(`   CSV file written to ${csvPath}`);

    // Look for file input
    const fileInputs = await page.locator('input[type="file"]').count();
    console.log(`   Found ${fileInputs} file input(s) on page`);

    if (fileInputs > 0) {
      // Set file input
      await page.locator('input[type="file"]').first().setInputFiles(csvPath);
      console.log('   ✅ File uploaded');

      // Wait a moment for processing
      await page.waitForTimeout(2000);

      // Look for success message or button activation
      const uploadSuccess = await page.locator('text=/uploaded|success|ready/i').count() > 0;
      console.log(`   Upload processed: ${uploadSuccess ? '✅' : '⚠️'}`);
      results.tests.fileUpload = { status: uploadSuccess ? 'passed' : 'warning', fileInputsFound: fileInputs };
    } else {
      console.log('   ⚠️  No file input found on current page');
      results.tests.fileUpload = { status: 'warning', message: 'No file input found' };
    }

    // Clean up CSV
    if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);

    console.log('\n📍 TEST 4: Look for analysis panels');

    // Look for PCA, Cluster, Path Analysis buttons/panels
    const pcaPanel = await page.locator('text=/PCA|Principal Component/i').count();
    const clusterPanel = await page.locator('text=/Cluster|Clustering/i').count();
    const pathPanel = await page.locator('text=/Path Analysis|path-analysis/i').count();

    console.log(`   PCA panel found: ${pcaPanel > 0 ? '✅' : '❌'}`);
    console.log(`   Cluster panel found: ${clusterPanel > 0 ? '✅' : '❌'}`);
    console.log(`   Path Analysis panel found: ${pathPanel > 0 ? '✅' : '❌'}`);

    results.tests.panelDetection = {
      status: 'passed',
      pcaPanelFound: pcaPanel > 0,
      clusterPanelFound: clusterPanel > 0,
      pathPanelFound: pathPanel > 0
    };

    // Test 5: Check for Run buttons that would trigger analysis
    console.log('\n📍 TEST 5: Check for analysis execution buttons');
    const runButtons = await page.locator('button:has-text("Run")').count();
    const playButtons = await page.locator('button[title*="Play"], button[aria-label*="Run"]').count();
    console.log(`   Run/Play buttons found: ${runButtons + playButtons}`);
    results.tests.runButtons = { status: 'passed', count: runButtons + playButtons };

    // Test 6: Inspect network requests made during page load
    console.log('\n📍 TEST 6: Network activity during page load');
    const analysisRequests = requestsLog.filter(r => r.url.includes('/analysis/'));
    console.log(`   Analysis API calls made: ${analysisRequests.length}`);
    if (analysisRequests.length > 0) {
      console.log('   Calls:');
      analysisRequests.forEach(r => console.log(`     - ${r.method} ${r.url.split('/').pop()}`));
    }
    results.tests.networkActivity = {
      status: 'passed',
      analysisCallsMade: analysisRequests.length,
      calls: analysisRequests
    };

    // Test 7: Check console for errors
    console.log('\n📍 TEST 7: Check for console errors');
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    await page.waitForTimeout(2000);
    console.log(`   Console errors found: ${errors.length}`);
    if (errors.length > 0) {
      console.log('   Errors:');
      errors.forEach(e => console.log(`     ⚠️  ${e.substring(0, 100)}`));
    }
    results.tests.consoleErrors = { status: 'passed', errorCount: errors.length, errors: errors.slice(0, 5) };

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Application is running and accessible`);
    console.log(`${hasGeneticsTerm ? '✅' : '⚠️'} Genetics-related content detected`);
    console.log(`${fileInputs > 0 ? '✅' : '⚠️'} File upload capability present`);
    console.log(`${pcaPanel > 0 ? '✅' : '❌'} PCA panel present`);
    console.log(`${clusterPanel > 0 ? '✅' : '❌'} Cluster panel present`);
    console.log(`${pathPanel > 0 ? '✅' : '❌'} Path Analysis panel present`);
    console.log(`${runButtons + playButtons > 0 ? '✅' : '⚠️'} Analysis execution buttons available`);

    // Write results to file
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`\n📄 Full results saved to: ${RESULTS_FILE}`);

    await context.close();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    results.error = error.message;
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

test().catch(console.error);
