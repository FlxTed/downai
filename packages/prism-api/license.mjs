import crypto from 'crypto';
import { findLicenseRecord, isLicenseRegistered, registerLicenseRecord, activateDevice } from './license-registry.mjs';
import { signSessionToken, verifySessionToken } from './session.mjs';

const SECRET = process.env.DOWNAI_LICENSE_SECRET;
if (!SECRET) {
  console.warn('[license] DOWNAI_LICENSE_SECRET is not set — key generation and validation will fail.');
}

function checksum(body) {
  if (!SECRET) return '';
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex').slice(0, 8).toUpperCase();
}

/** Verify key format + HMAC. Does not grant Pro without registry activation. */
export function verifyKeyFormat(key) {
  if (!SECRET || !key?.trim()) return { valid: false };
  const normalized = key.trim().toUpperCase();
  const match = normalized.match(
    /^(?:FDRY|MRD|AXIS|CROSS|VERTEX|PRISM|DOWNAI)-PRO-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{8})$/
  );
  if (!match) return { valid: false };

  const body = `${match[1]}${match[2]}`;
  if (checksum(body) !== match[3]) return { valid: false };

  return { valid: true, normalized };
}

export function validateLicenseKey(key) {
  const format = verifyKeyFormat(key);
  if (!format.valid) return { valid: false, isPro: false };

  const record = findLicenseRecord(format.normalized);
  if (!record) {
    return { valid: false, isPro: false, reason: 'not_issued' };
  }

  if (record.revoked) return { valid: false, isPro: false, reason: 'revoked' };

  if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) {
    return { valid: false, isPro: false, reason: 'expired' };
  }

  return {
    valid: true,
    isPro: true,
    expiresAt: record.expiresAt ? Date.parse(record.expiresAt) : undefined,
    email: record.email,
  };
}

export function resolveAuth({ bearer, licenseKey, deviceId }) {
  if (bearer) {
    const session = verifySessionToken(bearer);
    if (!session.valid) return { isPro: false, reason: session.expired ? 'session_expired' : 'invalid_session' };
    if (session.payload.deviceId && session.payload.deviceId !== deviceId) {
      return { isPro: false, reason: 'device_mismatch' };
    }
    return {
      isPro: session.payload.plan === 'pro',
      expiresAt: session.payload.licenseExpiresAt,
      email: session.payload.email,
      usageId: `pro:${session.payload.sub}`,
    };
  }

  const check = validateLicenseKey(licenseKey);
  if (!check.isPro) return { isPro: false, reason: check.reason || 'invalid_key' };

  return {
    isPro: true,
    expiresAt: check.expiresAt,
    email: check.email,
    usageId: `pro:${licenseKey.slice(-12)}`,
  };
}

export function activateLicenseKey(key, deviceId) {
  const format = verifyKeyFormat(key);
  if (!format.valid) {
    return { ok: false, status: 400, body: { error: 'Invalid license key.' } };
  }

  const activation = activateDevice(format.normalized, deviceId);
  if (!activation.ok) {
    return { ok: false, status: 403, body: { error: activation.error } };
  }

  const token = signSessionToken({
    sub: crypto.createHash('sha256').update(format.normalized).digest('hex').slice(0, 16),
    plan: 'pro',
    deviceId,
    email: activation.email,
    licenseExpiresAt: activation.expiresAt,
  });

  return {
    ok: true,
    status: 200,
    body: {
      token,
      plan: 'pro',
      email: activation.email,
      expiresAt: activation.expiresAt,
    },
  };
}

/** Generate a new Pro key and register it server-side. */
export function generateLicenseKey(expMonths = 12, meta = {}) {
  if (!SECRET) throw new Error('DOWNAI_LICENSE_SECRET is required to generate keys');

  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
  const part2 = (expMonths % 100).toString(36).toUpperCase().padStart(4, '0').slice(0, 4);
  const body = `${part1}${part2}`;
  const sig = checksum(body);
  const licenseKey = `DOWNAI-PRO-${part1}-${part2}-${sig}`;

  const expiresAt = new Date(Date.now() + expMonths * 30 * 24 * 60 * 60 * 1000).toISOString();

  if (!isLicenseRegistered(licenseKey)) {
    registerLicenseRecord({
      licenseKey,
      expiresAt,
      createdAt: new Date().toISOString(),
      devices: [],
      ...meta,
    });
  }

  return licenseKey;
}

export { verifySessionToken, signSessionToken };
