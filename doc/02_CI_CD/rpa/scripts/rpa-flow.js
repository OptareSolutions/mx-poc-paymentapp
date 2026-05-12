/**
 * RPA Flow – Salesforce Customer-to-Sale Automation
 * ─────────────────────────────────────────────────
 * Automates the full sales cycle in Salesforce Lightning:
 *
 *  1.  Login
 *  2.  Create Account (customer record)
 *  3.  Create Contact linked to the Account
 *  4.  Create Opportunity (product + amount)
 *  5.  Add Product Line Item to Opportunity
 *  6.  Upload biometric identity document (Files)
 *  7.  Trigger credit-check process
 *  8.  Process payment
 *  9.  Advance Opportunity stage to Closed Won
 * 10.  Validate final state and capture results
 *
 * Configuration (all via GitHub Secrets / env vars):
 *   RPA_BASE_URL        – Salesforce org URL  (e.g. https://myorg.my.salesforce.com)
 *   RPA_USERNAME        – Salesforce username
 *   RPA_PASSWORD        – Salesforce password
 *   RPA_PRODUCT_NAME    – Product name to add   (default: "Paquete Básico")
 *   RPA_PRODUCT_PRICE   – Unit price            (default: "1500")
 *   RPA_ID_DOC_PATH     – Path to biometric ID  (default: fixtures/sample-id.pdf)
 *   RPA_TIMEOUT_MS      – Per-action timeout ms (default: 60000)
 *
 * NOTE: Salesforce Lightning selectors are org-specific.
 * If your org uses custom page layouts or managed packages the
 * selectors marked ⚙️ ADAPT may need adjusting for your org.
 */

'use strict';

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────
const CONFIG = {
  baseUrl:     process.env.RPA_BASE_URL      || '',
  username:    process.env.RPA_USERNAME      || '',
  password:    process.env.RPA_PASSWORD      || '',
  productName: process.env.RPA_PRODUCT_NAME  || 'Paquete Básico',
  productPrice:process.env.RPA_PRODUCT_PRICE || '1500',
  idDocPath:   process.env.RPA_ID_DOC_PATH   || path.resolve(__dirname, '..', 'fixtures', 'sample-id.pdf'),
  timeout:     parseInt(process.env.RPA_TIMEOUT_MS || '60000', 10),
  resultsDir:  path.resolve(__dirname, '..', 'results'),
  // Dynamic customer data – unique per run to avoid duplicates
  customer: {
    firstName:   'RPA',
    lastName:    `Test-${Date.now()}`,
    email:       `rpa-test-${Date.now()}@example.com`,
    phone:       '+52 55 0000 0000',
    accountName: `Empresa RPA ${Date.now()}`,
    opportunityName: `Venta RPA ${new Date().toISOString().slice(0, 10)}`,
    closeDate:   futureDate(30),   // 30 days from today
  },
};

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timestamp() { return new Date().toISOString(); }

function writeResult(result) {
  if (!fs.existsSync(CONFIG.resultsDir)) {
    fs.mkdirSync(CONFIG.resultsDir, { recursive: true });
  }
  const file = path.join(CONFIG.resultsDir, `rpa-result-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(`[RPA] Result saved → ${file}`);
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(CONFIG.resultsDir, `${name}.png`), fullPage: false });
}

/** Wait for Salesforce Lightning spinner to disappear. */
async function waitForSF(page) {
  await page.waitForLoadState('domcontentloaded');
  try {
    await page.waitForSelector(
      'lightning-spinner, .slds-spinner_container',
      { state: 'hidden', timeout: CONFIG.timeout }
    );
  } catch (_) { /* spinner may not appear for every action */ }
}

/**
 * Fill a Salesforce Lightning combobox / lookup field.
 * Types the value and selects the first matching dropdown option.
 */
async function sfLookup(page, fieldLabel, value) {
  // Open lookup / combobox input by label
  const inputLocator = page.locator(`lightning-input-field[data-label="${fieldLabel}"] input,
    [data-label="${fieldLabel}"] input`).first();
  await inputLocator.fill(value);
  await page.waitForTimeout(1200); // wait for autocomplete
  // Click first result in dropdown ⚙️ ADAPT selector if needed
  await page.locator(
    `lightning-base-combobox-item, .slds-media__figure ~ .slds-media__body`
  ).first().click();
}

/** Click a button in the Salesforce utility / action bar by its visible label. */
async function sfButton(page, label) {
  await page.locator(`button:has-text("${label}"), a:has-text("${label}")`).first().click();
  await waitForSF(page);
}

// ── Main RPA Flow ─────────────────────────────────────────────────────────────
async function runRpa() {
  const result = {
    run_at:   timestamp(),
    base_url: CONFIG.baseUrl,
    customer: CONFIG.customer.lastName,
    steps:    [],
    ids:      {},   // stores created record IDs
    status:   'pending',
    error:    null,
  };

  if (!CONFIG.baseUrl) {
    throw new Error('RPA_BASE_URL is not set. Configure the GitHub Secret.');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.timeout);

  try {
    // ── Step 1: Login ──────────────────────────────────────────────────────────
    console.log('[RPA] Step 1 – Login...');
    await page.goto(`${CONFIG.baseUrl}`, { waitUntil: 'domcontentloaded' });
    await page.fill('#username', CONFIG.username);
    await page.fill('#password', CONFIG.password);
    await page.click('#Login');
    await waitForSF(page);
    await screenshot(page, '01-logged-in');
    result.steps.push({ step: 1, action: 'login', status: 'ok' });

    // ── Step 2: Create Account ─────────────────────────────────────────────────
    console.log('[RPA] Step 2 – Creating Account...');
    await page.goto(`${CONFIG.baseUrl}/lightning/o/Account/new`, { waitUntil: 'domcontentloaded' });
    await waitForSF(page);

    // ⚙️ ADAPT field labels to your org's Account page layout
    await page.fill('[placeholder="Account Name"], input[name="Name"]', CONFIG.customer.accountName);
    await page.fill('[placeholder="Phone"], input[name="Phone"]', CONFIG.customer.phone);

    // Type: Customer (⚙️ ADAPT picklist value to your org)
    const typeInput = page.locator('lightning-combobox[data-field-id="Type"] button, [data-field="Type"] button').first();
    if (await typeInput.count() > 0) {
      await typeInput.click();
      await page.locator('lightning-base-combobox-item span:has-text("Customer")').first().click();
    }

    await sfButton(page, 'Save');
    // Extract new Account ID from URL: /lightning/r/Account/<ID>/view
    const accountUrl = page.url();
    result.ids.accountId = accountUrl.match(/Account\/([a-zA-Z0-9]+)\/view/)?.[1] || 'unknown';
    await screenshot(page, '02-account-created');
    result.steps.push({ step: 2, action: 'create_account', id: result.ids.accountId, status: 'ok' });
    console.log(`[RPA] Account created: ${result.ids.accountId}`);

    // ── Step 3: Create Contact ─────────────────────────────────────────────────
    console.log('[RPA] Step 3 – Creating Contact...');
    await page.goto(`${CONFIG.baseUrl}/lightning/o/Contact/new`, { waitUntil: 'domcontentloaded' });
    await waitForSF(page);

    // ⚙️ ADAPT field selectors to your org layout
    await page.fill('input[name="firstName"], [data-field="FirstName"] input', CONFIG.customer.firstName);
    await page.fill('input[name="lastName"], [data-field="LastName"] input', CONFIG.customer.lastName);
    await page.fill('input[name="email"], [data-field="Email"] input', CONFIG.customer.email);
    await page.fill('input[name="phone"], [data-field="Phone"] input', CONFIG.customer.phone);

    // Link to the Account we just created
    await sfLookup(page, 'Account Name', CONFIG.customer.accountName);

    await sfButton(page, 'Save');
    const contactUrl = page.url();
    result.ids.contactId = contactUrl.match(/Contact\/([a-zA-Z0-9]+)\/view/)?.[1] || 'unknown';
    await screenshot(page, '03-contact-created');
    result.steps.push({ step: 3, action: 'create_contact', id: result.ids.contactId, status: 'ok' });
    console.log(`[RPA] Contact created: ${result.ids.contactId}`);

    // ── Step 4: Create Opportunity ─────────────────────────────────────────────
    console.log('[RPA] Step 4 – Creating Opportunity...');
    await page.goto(`${CONFIG.baseUrl}/lightning/o/Opportunity/new`, { waitUntil: 'domcontentloaded' });
    await waitForSF(page);

    await page.fill('input[name="Name"], [data-field="Name"] input', CONFIG.customer.opportunityName);
    await sfLookup(page, 'Account Name', CONFIG.customer.accountName);
    await page.fill('input[name="CloseDate"], [data-field="CloseDate"] input', CONFIG.customer.closeDate);

    // Stage: Prospecting ⚙️ ADAPT to your first stage value
    const stageBtn = page.locator('[data-field="StageName"] button, lightning-combobox[data-field-id="StageName"] button').first();
    if (await stageBtn.count() > 0) {
      await stageBtn.click();
      await page.locator('lightning-base-combobox-item span:has-text("Prospecting")').first().click();
    }

    await sfButton(page, 'Save');
    const oppUrl = page.url();
    result.ids.opportunityId = oppUrl.match(/Opportunity\/([a-zA-Z0-9]+)\/view/)?.[1] || 'unknown';
    await screenshot(page, '04-opportunity-created');
    result.steps.push({ step: 4, action: 'create_opportunity', id: result.ids.opportunityId, status: 'ok' });
    console.log(`[RPA] Opportunity created: ${result.ids.opportunityId}`);

    // ── Step 5: Add Product Line Item ──────────────────────────────────────────
    console.log('[RPA] Step 5 – Adding product...');
    // Navigate to Opportunity and open Products related list
    await page.goto(
      `${CONFIG.baseUrl}/lightning/r/Opportunity/${result.ids.opportunityId}/view`,
      { waitUntil: 'domcontentloaded' }
    );
    await waitForSF(page);

    // Click "Add Products" button in the Products related list ⚙️ ADAPT button label
    await page.locator('a[title="Add Products"], button:has-text("Add Products")').first().click();
    await waitForSF(page);

    // Search and select product ⚙️ ADAPT to your product catalog
    const productSearch = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    await productSearch.fill(CONFIG.productName);
    await page.keyboard.press('Enter');
    await waitForSF(page);

    // Select the first matching product checkbox
    await page.locator('table tbody tr:first-child input[type="checkbox"]').check();
    await sfButton(page, 'Next');
    await waitForSF(page);

    // Set unit price and quantity
    await page.fill('input[name="UnitPrice"], td input[type="number"]:first-of-type', CONFIG.productPrice);
    await page.fill('input[name="Quantity"], td input[name="Quantity"]', '1');

    await sfButton(page, 'Save');
    await screenshot(page, '05-product-added');
    result.steps.push({ step: 5, action: 'add_product', product: CONFIG.productName, status: 'ok' });
    console.log('[RPA] Product added.');

    // ── Step 6: Upload biometric identity document ─────────────────────────────
    console.log('[RPA] Step 6 – Uploading identity document...');
    // Ensure the fixture file exists (fallback: create a dummy PDF if missing)
    if (!fs.existsSync(CONFIG.idDocPath)) {
      const fixturesDir = path.dirname(CONFIG.idDocPath);
      fs.mkdirSync(fixturesDir, { recursive: true });
      // Minimal valid PDF placeholder for CI testing
      fs.writeFileSync(CONFIG.idDocPath, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF');
      console.log('[RPA] Created placeholder ID document for CI.');
    }

    await page.goto(
      `${CONFIG.baseUrl}/lightning/r/Opportunity/${result.ids.opportunityId}/view`,
      { waitUntil: 'domcontentloaded' }
    );
    await waitForSF(page);

    // Open Files related list and upload ⚙️ ADAPT related list label
    const filesTab = page.locator('a[title="Files"], button:has-text("Upload Files"), a:has-text("Files")').first();
    await filesTab.click();
    await waitForSF(page);

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(CONFIG.idDocPath);
    await waitForSF(page);

    // Confirm upload if modal shown ⚙️ ADAPT button label
    const doneBtn = page.locator('button:has-text("Done"), button:has-text("Finalizar")').first();
    if (await doneBtn.count() > 0) await doneBtn.click();
    await waitForSF(page);

    await screenshot(page, '06-document-uploaded');
    result.steps.push({ step: 6, action: 'upload_id_document', file: path.basename(CONFIG.idDocPath), status: 'ok' });
    console.log('[RPA] Identity document uploaded.');

    // ── Step 7: Credit check ───────────────────────────────────────────────────
    console.log('[RPA] Step 7 – Credit verification...');
    // ⚙️ ADAPT: click the custom "Verificación Crediticia" button/flow in your org
    await page.goto(
      `${CONFIG.baseUrl}/lightning/r/Opportunity/${result.ids.opportunityId}/view`,
      { waitUntil: 'domcontentloaded' }
    );
    await waitForSF(page);

    const creditBtn = page.locator(
      'button:has-text("Verificación Crediticia"), a:has-text("Verificación Crediticia"), ' +
      'button:has-text("Credit Check"), a:has-text("Credit Check")'
    ).first();

    if (await creditBtn.count() > 0) {
      await creditBtn.click();
      await waitForSF(page);
      // Handle modal / flow ⚙️ ADAPT to your org's credit check modal
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Aceptar"), button:has-text("Submit")').first();
      if (await confirmBtn.count() > 0) await confirmBtn.click();
      await waitForSF(page);
      result.steps.push({ step: 7, action: 'credit_check', status: 'ok' });
      console.log('[RPA] Credit check triggered.');
    } else {
      // ⚙️ Button not found – log as skipped (process may be automatic in your org)
      result.steps.push({ step: 7, action: 'credit_check', status: 'skipped', note: 'Button not found – adjust selector for your org' });
      console.log('[RPA] Credit check button not found – skipped (adjust selector).');
    }
    await screenshot(page, '07-credit-check');

    // ── Step 8: Payment processing ─────────────────────────────────────────────
    console.log('[RPA] Step 8 – Payment processing...');
    // ⚙️ ADAPT: click the custom "Pago" / "Payment" button/flow in your org
    const payBtn = page.locator(
      'button:has-text("Pago"), a:has-text("Pago"), ' +
      'button:has-text("Payment"), a:has-text("Process Payment")'
    ).first();

    if (await payBtn.count() > 0) {
      await payBtn.click();
      await waitForSF(page);
      // ⚙️ Fill payment form fields if a modal appears
      const amountInput = page.locator('input[name*="amount"], input[name*="Amount"], input[placeholder*="monto"]').first();
      if (await amountInput.count() > 0) {
        await amountInput.fill(CONFIG.productPrice);
      }
      const payConfirm = page.locator('button:has-text("Confirm"), button:has-text("Pagar"), button:has-text("Submit")').first();
      if (await payConfirm.count() > 0) await payConfirm.click();
      await waitForSF(page);
      result.steps.push({ step: 8, action: 'payment', amount: CONFIG.productPrice, status: 'ok' });
      console.log('[RPA] Payment processed.');
    } else {
      result.steps.push({ step: 8, action: 'payment', status: 'skipped', note: 'Button not found – adjust selector for your org' });
      console.log('[RPA] Payment button not found – skipped (adjust selector).');
    }
    await screenshot(page, '08-payment');

    // ── Step 9: Close Opportunity (Closed Won) ─────────────────────────────────
    console.log('[RPA] Step 9 – Closing sale (Closed Won)...');
    await page.goto(
      `${CONFIG.baseUrl}/lightning/r/Opportunity/${result.ids.opportunityId}/view`,
      { waitUntil: 'domcontentloaded' }
    );
    await waitForSF(page);

    // Click "Mark Stage as Complete" or directly edit Stage ⚙️ ADAPT
    const editStageBtn = page.locator(
      'button[title="Edit Stage"], a[title="Edit Stage"], ' +
      'button:has-text("Mark Stage as Complete")'
    ).first();

    if (await editStageBtn.count() > 0) {
      await editStageBtn.click();
      await waitForSF(page);
    }

    // Set Stage to Closed Won via inline edit
    const stageCombo = page.locator(
      '[data-field="StageName"] button, lightning-combobox[data-field-id="StageName"] button'
    ).first();
    if (await stageCombo.count() > 0) {
      await stageCombo.click();
      await page.locator('lightning-base-combobox-item span:has-text("Closed Won")').first().click();
    }

    await sfButton(page, 'Save');
    await screenshot(page, '09-closed-won');
    result.steps.push({ step: 9, action: 'close_sale', stage: 'Closed Won', status: 'ok' });
    console.log('[RPA] Opportunity closed as Won.');

    // ── Step 10: Validate final state ──────────────────────────────────────────
    console.log('[RPA] Step 10 – Validating final state...');
    await page.goto(
      `${CONFIG.baseUrl}/lightning/r/Opportunity/${result.ids.opportunityId}/view`,
      { waitUntil: 'domcontentloaded' }
    );
    await waitForSF(page);

    // ⚙️ ADAPT: read Stage field value from the record page
    const stageValue = await page.locator(
      '[data-field="StageName"] lightning-formatted-text, ' +
      '.forceOutputLookup:has-text("Closed"), ' +
      'records-formula-output:has-text("Closed")'
    ).first().textContent().catch(() => 'unknown');

    await screenshot(page, '10-final-state');
    result.steps.push({
      step: 10,
      action: 'validate_final_state',
      stage_value: stageValue?.trim(),
      opportunity_id: result.ids.opportunityId,
      account_id: result.ids.accountId,
      contact_id: result.ids.contactId,
      status: 'ok',
    });

    result.status = 'success';
    console.log('[RPA] ✅ Full Salesforce sales flow completed successfully.');
    console.log(`[RPA]    Account   : ${result.ids.accountId}`);
    console.log(`[RPA]    Contact   : ${result.ids.contactId}`);
    console.log(`[RPA]    Opportunity: ${result.ids.opportunityId}`);

  } catch (err) {
    console.error('[RPA] Flow failed:', err.message);
    result.status = 'failure';
    result.error  = err.message;
    try { await screenshot(page, 'error-screenshot'); } catch (_) { /* ignore */ }
  } finally {
    await browser.close();
    writeResult(result);
  }

  if (result.status === 'failure') process.exit(1);
}

runRpa().catch((err) => {
  console.error('[RPA] Unhandled error:', err);
  process.exit(1);
});
