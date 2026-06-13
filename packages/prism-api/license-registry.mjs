import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISSUED_PATH = path.join(__dirname, 'data', 'issued-licenses.json');
const MAX_DEVICES = Number(process.env.DOWNAI_MAX_DEVICES_PER_KEY || 3);

function ensureDataDir() {
  const dir = path.dirname(ISSUED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(ISSUED_PATH)) fs.writeFileSync(ISSUED_PATH, '[]', 'utf8');
}

export function loadIssued() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(ISSUED_PATH, 'utf8'));
}

export function saveIssued(records) {
  ensureDataDir();
  fs.writeFileSync(ISSUED_PATH, JSON.stringify(records, null, 2), 'utf8');
}

export function findLicenseRecord(key) {
  const normalized = key?.trim().toUpperCase();
  if (!normalized) return null;
  return loadIssued().find((r) => r.licenseKey === normalized) ?? null;
}

export function registerLicenseRecord(record) {
  const issued = loadIssued();
  const normalized = record.licenseKey.trim().toUpperCase();
  if (issued.some((r) => r.licenseKey === normalized)) {
    throw new Error('License key already registered');
  }
  issued.push({ ...record, licenseKey: normalized, devices: record.devices ?? [] });
  saveIssued(issued);
  return record;
}

export function activateDevice(key, deviceId) {
  const normalized = key.trim().toUpperCase();
  const issued = loadIssued();
  const record = issued.find((r) => r.licenseKey === normalized);
  if (!record) return { ok: false, error: 'License key not found. Contact support.' };

  if (record.revoked) return { ok: false, error: 'License key has been revoked.' };

  if (record.expiresAt && Date.parse(record.expiresAt) < Date.now()) {
    return { ok: false, error: 'License key has expired.' };
  }

  const devices = record.devices ?? [];
  const existing = devices.find((d) => d.id === deviceId);
  if (!existing && devices.length >= MAX_DEVICES) {
    return {
      ok: false,
      error: `This license is already active on ${MAX_DEVICES} devices. Deactivate one first.`,
    };
  }

  if (!existing) {
    devices.push({ id: deviceId, activatedAt: new Date().toISOString() });
    record.devices = devices;
    saveIssued(issued);
  }

  return {
    ok: true,
    record,
    email: record.email ?? undefined,
    expiresAt: record.expiresAt ? Date.parse(record.expiresAt) : undefined,
  };
}

export function isLicenseRegistered(key) {
  return !!findLicenseRecord(key);
}
