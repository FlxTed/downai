import crypto from 'crypto';

const SESSION_SECRET =
  process.env.DOWNAI_SESSION_SECRET ||
  process.env.DOWNAI_LICENSE_SECRET ||
  'change-me-in-production';

function b64url(data) {
  return Buffer.from(data).toString('base64url');
}

function fromB64url(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

export function signSessionToken(payload, ttlSeconds = 60 * 60 * 24 * 30) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    })
  );
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token?.includes('.')) return { valid: false };
  const [header, body, sig] = token.split('.');
  if (!header || !body || !sig) return { valid: false };

  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
      return { valid: false };
    }
  } catch {
    return { valid: false };
  }

  let payload;
  try {
    payload = JSON.parse(fromB64url(body));
  } catch {
    return { valid: false };
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return { valid: false, expired: true };
  }

  return { valid: true, payload };
}
