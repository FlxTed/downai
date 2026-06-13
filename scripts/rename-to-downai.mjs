import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const root = join(import.meta.dirname, '..');
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'release',
  'win-unpacked',
  'dist-electron',
]);
const SKIP_PATH_PARTS = ['node_modules', 'release\\win-unpacked', 'dist\\assets'];
const EXT = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.json', '.html', '.md', '.css', '.svg', '.txt', '.example', '.yaml', '.yml',
]);

function shouldProcess(filePath) {
  if (SKIP_PATH_PARTS.some((p) => filePath.includes(p))) return false;
  const base = filePath.split(/[/\\]/).pop();
  if (base === '.env') return true;
  if (base === 'vercel.json') return true;
  const ext = extname(base);
  return EXT.has(ext);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(p, out);
    } else if (shouldProcess(p)) {
      out.push(p);
    }
  }
  return out;
}

function transform(text) {
  return text
    .replace(/DownAI-Setup/g, 'DownAI-Setup')
    .replace(/DownAI/g, 'DownAI')
    .replace(/DOWNAI/g, 'DOWNAI')
    .replace(/downai\.dev/g, 'downai.dev')
    .replace(/downai/g, 'downai');
}

let changed = 0;
for (const file of walk(root)) {
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    changed++;
  }
}
console.log(`Updated ${changed} files.`);
