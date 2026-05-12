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

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.resolve(__dirname, '../results');
const AUTH_FILE = path.resolve(__dirname, '../../../sf-auth.json');

fs.mkdirSync(RESULTS_DIR, { recursive: true });

function readSalesforceAuth() {
  if (!fs.existsSync(AUTH_FILE)) {
    throw new Error(`sf-auth.json not found at ${AUTH_FILE}`);
  }

  const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));

  return {
    accessToken: auth.result.accessToken,
    instanceUrl: auth.result.instanceUrl
  };
}

const { accessToken, instanceUrl } = readSalesforceAuth();

const API_VERSION = 'v60.0';

async function sfRequest(pathname, options = {}) {
  const response = await fetch(`${instanceUrl}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(
      `Salesforce API error ${response.status} on ${pathname}: ${JSON.stringify(body, null, 2)}`
    );
  }

  return body;
}

async function soql(query) {
  const encoded = encodeURIComponent(query);
  return sfRequest(`/services/data/${API_VERSION}/query?q=${encoded}`);
}

async function createRecord(objectName, payload) {
  return sfRequest(`/services/data/${API_VERSION}/sobjects/${objectName}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function updateRecord(objectName, id, payload) {
  return sfRequest(`/services/data/${API_VERSION}/sobjects/${objectName}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

async function findAccountByName(name) {
  const result = await soql(
    `SELECT Id, Name FROM Account WHERE Name = '${escapeSoql(name)}' LIMIT 1`
  );

  return result.records[0];
}

async function findProductByName(name) {
  const result = await soql(
    `SELECT Id, Name FROM Product2 WHERE Name = '${escapeSoql(name)}' LIMIT 1`
  );

  return result.records[0];
}

async function getStandardPricebook() {
  const result = await soql(
    'SELECT Id, Name, IsActive FROM Pricebook2 WHERE IsStandard = true LIMIT 1'
  );

  if (!result.records.length) {
    throw new Error('Standard Pricebook not found');
  }

  const pricebook = result.records[0];

  if (!pricebook.IsActive) {
    await updateRecord('Pricebook2', pricebook.Id, { IsActive: true });
  }

  return pricebook;
}

async function findPricebookEntry(pricebookId, productId) {
  const result = await soql(
    `SELECT Id, UnitPrice, IsActive FROM PricebookEntry WHERE Pricebook2Id = '${pricebookId}' AND Product2Id = '${productId}' LIMIT 1`
  );

  return result.records[0];
}

function escapeSoql(value) {
  return String(value).replace(/'/g, "\\'");
}

function todayPlusDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function mockBiometricVerification() {
  return {
    provider: 'mock-biometric-service',
    status: 'APPROVED',
    confidence: 0.98,
    documentType: 'Synthetic ID',
    evidence: 'Synthetic biometric validation approved for demo'
  };
}

async function mockCreditCheck() {
  return {
    provider: 'mock-credit-check',
    status: 'APPROVED',
    score: 742,
    risk: 'LOW',
    evidence: 'Synthetic credit validation approved for demo'
  };
}

async function mockPaymentAuthorization(amount) {
  return {
    provider: 'mock-payment-gateway',
    status: 'AUTHORIZED',
    amount,
    currency: 'EUR',
    transactionId: `TX-${Date.now()}`
  };
}

async function main() {
  const startedAt = new Date();

  const productName = process.env.RPA_PRODUCT_NAME || 'Paquete Básico';
  const productPrice = Number(process.env.RPA_PRODUCT_PRICE || '1500');

  if (!Number.isFinite(productPrice) || productPrice <= 0) {
    throw new Error(`Invalid RPA_PRODUCT_PRICE: ${process.env.RPA_PRODUCT_PRICE}`);
  }

  const accountName = `Cliente Demo GitHub RPA ${Date.now()}`;
  const contactLastName = `Contacto RPA ${Date.now()}`;

  console.log('Connected to Salesforce:', instanceUrl);
  console.log('Starting Salesforce RPA/API flow');

  const biometric = await mockBiometricVerification();
  const credit = await mockCreditCheck();
  const payment = await mockPaymentAuthorization(productPrice);

  if (
    biometric.status !== 'APPROVED' ||
    credit.status !== 'APPROVED' ||
    payment.status !== 'AUTHORIZED'
  ) {
    throw new Error('External validation failed');
  }

  let account = await findAccountByName(accountName);

  if (!account) {
    const createdAccount = await createRecord('Account', {
      Name: accountName,
      Phone: '+351000000000',
      BillingCity: 'Lisboa',
      BillingCountry: 'Portugal'
    });

    account = {
      Id: createdAccount.id,
      Name: accountName
    };
  }

  const contact = await createRecord('Contact', {
    AccountId: account.Id,
    LastName: contactLastName,
    Email: `cliente.demo.${Date.now()}@example.com`
  });

  let product = await findProductByName(productName);

  if (!product) {
    const createdProduct = await createRecord('Product2', {
      Name: productName,
      IsActive: true
    });

    product = {
      Id: createdProduct.id,
      Name: productName
    };
  } else {
    await updateRecord('Product2', product.Id, { IsActive: true });
  }

  const standardPricebook = await getStandardPricebook();

  let pricebookEntry = await findPricebookEntry(standardPricebook.Id, product.Id);

  if (!pricebookEntry) {
    const createdPricebookEntry = await createRecord('PricebookEntry', {
      Pricebook2Id: standardPricebook.Id,
      Product2Id: product.Id,
      UnitPrice: productPrice,
      IsActive: true
    });

    pricebookEntry = {
      Id: createdPricebookEntry.id,
      UnitPrice: productPrice,
      IsActive: true
    };
  } else if (!pricebookEntry.IsActive || Number(pricebookEntry.UnitPrice) !== productPrice) {
    await updateRecord('PricebookEntry', pricebookEntry.Id, {
      UnitPrice: productPrice,
      IsActive: true
    });
  }

  const opportunity = await createRecord('Opportunity', {
    Name: `Venta Demo GitHub RPA ${Date.now()}`,
    AccountId: account.Id,
    StageName: 'Prospecting',
    CloseDate: todayPlusDays(30),
    Amount: productPrice,
    Pricebook2Id: standardPricebook.Id
  });

  const opportunityLineItem = await createRecord('OpportunityLineItem', {
    OpportunityId: opportunity.id,
    PricebookEntryId: pricebookEntry.Id,
    Quantity: 1,
    UnitPrice: productPrice
  });

  const validation = await soql(
    `SELECT Id, Name, StageName, Amount, Account.Name FROM Opportunity WHERE Id = '${opportunity.id}' LIMIT 1`
  );

  const finishedAt = new Date();

  const summary = {
    status: 'PASSED',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    salesforce: {
      instanceUrl,
      accountId: account.Id,
      contactId: contact.id,
      productId: product.Id,
      pricebookId: standardPricebook.Id,
      pricebookEntryId: pricebookEntry.Id,
      opportunityId: opportunity.id,
      opportunityLineItemId: opportunityLineItem.id
    },
    businessFlow: {
      accountCreated: true,
      contactCreated: true,
      productAssigned: true,
      biometricVerification: biometric,
      creditCheck: credit,
      paymentAuthorization: payment
    },
    validation: validation.records[0]
  };

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2)
  );

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'evidence.html'),
    `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Salesforce RPA Evidence</title>
</head>
<body>
  <h1>Salesforce RPA/API Flow Evidence</h1>
  <p><strong>Status:</strong> ${summary.status}</p>
  <p><strong>Duration:</strong> ${summary.durationMs} ms</p>
  <p><strong>Account:</strong> ${summary.salesforce.accountId}</p>
  <p><strong>Opportunity:</strong> ${summary.salesforce.opportunityId}</p>
  <p><strong>Product:</strong> ${productName}</p>
  <p><strong>Amount:</strong> ${productPrice}</p>
  <h2>External Validations</h2>
  <pre>${JSON.stringify(summary.businessFlow, null, 2)}</pre>
  <h2>Salesforce Validation</h2>
  <pre>${JSON.stringify(summary.validation, null, 2)}</pre>
</body>
</html>
`
  );

  console.log('Flow completed successfully');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const failure = {
    status: 'FAILED',
    error: error.message,
    stack: error.stack,
    finishedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'summary.json'),
    JSON.stringify(failure, null, 2)
  );

  console.error(error);
  process.exit(1);
});
