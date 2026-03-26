function fn() {
  var env = karate.env || 'local';
  var config = {
    baseUrl: 'http://localhost:8080',
    customerProfileUrl: 'http://localhost:8081'
  };
  if (env === 'ci') {
    config.baseUrl = 'http://localhost:8080';
    config.customerProfileUrl = 'http://localhost:8081';
  }
  return config;
}
