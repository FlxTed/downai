import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USAGE_PATH = path.join(__dirname, 'data', 'usage.json');

function ensureDataDir() {
  const dir = path.dirname(USAGE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(USAGE_PATH)) fs.writeFileSync(USAGE_PATH, '{}', 'utf8');
}

function loadAll() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveAll(data) {
  ensureDataDir();
  fs.writeFileSync(USAGE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function getUsage(id) {
  const day = new Date().toISOString().slice(0, 10);
  const all = loadAll();
  const row = all[id] || { day, count: 0 };
  if (row.day !== day) return { day, count: 0 };
  return row;
}

export function bumpUsage(id) {
  const row = getUsage(id);
  row.count += 1;
  const all = loadAll();
  all[id] = row;
  saveAll(all);
  return row;
}
