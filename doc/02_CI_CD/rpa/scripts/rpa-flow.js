/**
 * RPA Flow - Lightweight web automation using Playwright
 * Integrates with GitHub Actions CI/CD pipeline.
 *
 * Flow:
 *  1. Login to web application
 *  2. Query a record
 *  3. Validate / download data
 *  4. Record result to JSON file
 *
 * Configuration via environment variables:
 *   RPA_BASE_URL    - Target web application URL
 *   RPA_USERNAME    - Login username (from GitHub secret)
 *   RPA_PASSWORD    - Login password (from GitHub secret)
 *   RPA_RECORD_ID   - Record identifier to query
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  baseUrl:   process.env.RPA_BASE_URL    || 'https://example.com',
  username:  process.env.RPA_USERNAME    || '',
  password:  process.env.RPA_PASSWORD    || '',
  recordId:  process.env.RPA_RECORD_ID   || '1',
  timeout:   parseInt(process.env.RPA_TIMEOUT_MS || '30000', 10),
  resultsDir: path.resolve(__dirname, '..', 'results'),
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function timestamp() {
  return new Date().toISOString();
}

function writeResult(result) {
  if (!fs.existsSync(CONFIG.resultsDir)) {
    fs.mkdirSync(CONFIG.resultsDir, { recursive: true });
  }
  const file = path.join(CONFIG.resultsDir, `rpa-result-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(`[RPA] Result saved → ${file}`);
}

// ── Main RPA Flow ────────────────────────────────────────────────────────────
async function runRpa() {
  const result = {
    run_at:    timestamp(),
    base_url:  CONFIG.baseUrl,
    record_id: CONFIG.recordId,
    steps:     [],
    status:    'pending',
    error:     null,
  };

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',   // critical for container runners
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.timeout);

  try {
    // ── Step 1: Navigate to login page ───────────────────────────────────────
    console.log('[RPA] Step 1 – Navigating to login page...');
    await page.goto(CONFIG.baseUrl, { waitUntil: 'domcontentloaded' });
    result.steps.push({ step: 1, action: 'navigate', url: CONFIG.baseUrl, status: 'ok' });

    // ── Step 2: Login ────────────────────────────────────────────────────────
    console.log('[RPA] Step 2 – Logging in...');
    // Adapt selectors to the actual application:
    await page.fill('input[name="username"], input[type="email"], #username', CONFIG.username);
    await page.fill('input[name="password"], input[type="password"], #password', CONFIG.password);
    await page.click('button[type="submit"], input[type="submit"], .login-btn');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: path.join(CONFIG.resultsDir, 'step2-logged-in.png'),
    });
    result.steps.push({ step: 2, action: 'login', status: 'ok' });

    // ── Step 3: Query record ─────────────────────────────────────────────────
    console.log(`[RPA] Step 3 – Querying record ${CONFIG.recordId}...`);
    // Adapt URL pattern and selectors to the actual application:
    await page.goto(`${CONFIG.baseUrl}/records/${CONFIG.recordId}`, {
      waitUntil: 'domcontentloaded',
    });

    // Wait for data to render
    const recordSelector = '[data-testid="record-value"], .record-value, #record-data';
    await page.waitForSelector(recordSelector, { timeout: CONFIG.timeout });
    const recordValue = await page.textContent(recordSelector);

    await page.screenshot({
      path: path.join(CONFIG.resultsDir, 'step3-record.png'),
    });
    result.steps.push({
      step: 3,
      action: 'query_record',
      record_id: CONFIG.recordId,
      value: recordValue?.trim(),
      status: 'ok',
    });

    // ── Step 4: Validate / download data ─────────────────────────────────────
    console.log('[RPA] Step 4 – Validating data...');
    const isValid = recordValue && recordValue.trim().length > 0;
    if (!isValid) {
      throw new Error(`Record ${CONFIG.recordId} returned empty data`);
    }

    result.steps.push({
      step: 4,
      action: 'validate',
      is_valid: isValid,
      status: 'ok',
    });

    result.status = 'success';
    console.log('[RPA] Flow completed successfully.');
  } catch (err) {
    console.error('[RPA] Flow failed:', err.message);
    result.status = 'failure';
    result.error  = err.message;

    // Capture failure screenshot
    try {
      await page.screenshot({
        path: path.join(CONFIG.resultsDir, 'error-screenshot.png'),
      });
    } catch (_) { /* ignore screenshot errors */ }
  } finally {
    await browser.close();
    writeResult(result);
  }

  if (result.status === 'failure') {
    process.exit(1);
  }
}

runRpa().catch((err) => {
  console.error('[RPA] Unhandled error:', err);
  process.exit(1);
});
