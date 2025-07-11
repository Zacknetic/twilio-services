function handleCors(event) {
  const response = new Twilio.Response();
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.appendHeader('Content-Type', 'application/json');

  // Return info about whether it was preflight
  if (
    (event.request && event.request.method === 'OPTIONS') ||
    event.httpMethod === 'OPTIONS'
  ) {
    response.setStatusCode(200);
    return { response, isPreflight: true };
  }
  return { response, isPreflight: false };
}

module.exports = { handleCors };
