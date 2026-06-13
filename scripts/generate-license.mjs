#!/usr/bin/env node
/**
 * Generate DownAI Pro license keys (server-side registry required).
 * Usage: DOWNAI_LICENSE_SECRET=... node scripts/generate-license.mjs [count]
 *
 * Keys are registered in packages/prism-api/data/issued-licenses.json
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SECRET = process.env.DOWNAI_LICENSE_SECRET;
const ISSUED_PATH = path.join(__dirname, '../packages/prism-api/data/issued-licenses.json');

if (!SECRET) {
  console.error('Set DOWNAI_LICENSE_SECRET before generating keys.');
  process.exit(1);
}

function checksum(body) {
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex').slice(0, 8).toUpperCase();
}

function ensureDataDir() {
  const dir = path.dirname(ISSUED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(ISSUED_PATH)) fs.writeFileSync(ISSUED_PATH, '[]', 'utf8');
}

function loadIssued() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(ISSUED_PATH, 'utf8'));
}

function saveIssued(records) {
  ensureDataDir();
  fs.writeFileSync(ISSUED_PATH, JSON.stringify(records, null, 2), 'utf8');
}

function generateKey(expMonths = 12) {
  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 4);
  const part2 = (expMonths % 100).toString(36).toUpperCase().padStart(4, '0').slice(0, 4);
  const body = `${part1}${part2}`;
  const sig = checksum(body);
  const licenseKey = `DOWNAI-PRO-${part1}-${part2}-${sig}`;
  const expiresAt = new Date(Date.now() + expMonths * 30 * 24 * 60 * 60 * 1000).toISOString();
  return { licenseKey, expiresAt };
}

const count = parseInt(process.argv[2] || '1', 10);
const issued = loadIssued();

console.log('DownAI Pro License Keys:\n');
for (let i = 0; i < count; i++) {
  const { licenseKey, expiresAt } = generateKey(12);
  issued.push({
    licenseKey,
    expiresAt,
    createdAt: new Date().toISOString(),
    devices: [],
    source: 'cli',
  });
  console.log(licenseKey);
}
saveIssued(issued);

console.log('\nRegistered in issued-licenses.json. Valid for 12 months.');
