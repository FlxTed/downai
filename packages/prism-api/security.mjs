const ALLOWED_ORIGINS = new Set(
  (process.env.DOWNAI_CORS_ORIGINS ||
    'https://downai.dev,https://www.downai.dev,http://localhost:5173,http://localhost:5174,http://localhost:5175')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

export function corsHeaders(req) {
  const origin = req.headers.origin;
  const allowOrigin =
    !origin || ALLOWED_ORIGINS.has(origin) ? origin || 'null' : 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-DownAI-License, X-DownAI-Device',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(res, req, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...corsHeaders(req),
  });
  res.end(JSON.stringify(body));
}

export function readAuth(req) {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const licenseKey = req.headers['x-downai-license'] || '';
  const deviceId = req.headers['x-downai-device'] || 'anonymous';
  return { bearer, licenseKey, deviceId };
}
