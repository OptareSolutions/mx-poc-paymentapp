function fn() {
  var env = karate.env || 'local';

  // ── Base URLs ─────────────────────────────────────────────────────────────────
  var config = {
    // microservice-a: recarga / pago
    baseUrl: 'http://localhost:8080',
    // microservice-b: customer profile
    customerProfileUrl: 'http://localhost:8081',
    // mock auth server (Prism or WireMock)
    authUrl: 'http://localhost:9000',
    // default test credentials
    authUser: 'agente01',
    authPass: 'pass1234',
    // shared state (populated by auth scenario)
    accessToken: null,
    refreshToken: null
  };

  if (env === 'ci') {
    config.baseUrl           = 'http://localhost:8080';
    config.customerProfileUrl = 'http://localhost:18081';
    config.authUrl           = 'http://localhost:9000';
  }

  if (env === 'staging') {
    config.baseUrl           = 'https://staging-api.att-paymentbox.internal';
    config.customerProfileUrl = 'https://staging-profiles.att-paymentbox.internal';
    config.authUrl           = 'https://staging-auth.att-paymentbox.internal';
  }

  // Helper: add Bearer token header (used in Background sections)
  karate.configure('connectTimeout', 10000);
  karate.configure('readTimeout', 15000);

  return config;
}
