import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const releaseDir = join(root, 'packages/meridian-app/release');
const destDir = join(root, 'packages/meridian-website/public/downloads');

const pkg = JSON.parse(readFileSync(join(root, 'packages/meridian-app/package.json'), 'utf-8'));
const version = pkg.version ?? '1.0.0';

async function ensureFile(destName, findSource, fallbackUrl, minBytes = 1024 * 1024) {
  const destPath = join(destDir, destName);
  if (existsSync(destPath) && statSync(destPath).size > minBytes) {
    console.log(`[prepare-vercel-build] Present → ${destName}`);
    return;
  }

  const source = findSource();
  if (source) {
    copyFileSync(source, destPath);
    console.log(`[prepare-vercel-build] Copied → ${destName}`);
    return;
  }

  console.warn(`[prepare-vercel-build] Fetching ${fallbackUrl}`);
  const res = await fetch(fallbackUrl);
  if (!res.ok) throw new Error(`Could not fetch ${destName} (${res.status})`);

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < minBytes) throw new Error(`${destName} download too small`);

  writeFileSync(destPath, buffer);
  console.log(`[prepare-vercel-build] Downloaded ${destName} (${(buffer.length / (1024 * 1024)).toFixed(1)} MB)`);
}

function findReleaseExe() {
  if (!existsSync(releaseDir)) return null;
  for (const name of readdirSync(releaseDir)) {
    if (name.endsWith('.exe') && /downai/i.test(name)) return join(releaseDir, name);
  }
  return null;
}

function findReleaseDmg() {
  if (!existsSync(releaseDir)) return null;
  for (const name of readdirSync(releaseDir)) {
    if (name.endsWith('.dmg') && /^DownAI-/i.test(name)) return join(releaseDir, name);
  }
  return null;
}

mkdirSync(destDir, { recursive: true });

await ensureFile(
  `DownAI-Setup-${version}.exe`,
  findReleaseExe,
  process.env.DOWNAI_WINDOWS_DOWNLOAD_URL || 'https://downai.vercel.app/downloads/DownAI-Setup-1.0.0.exe'
);

await ensureFile(
  `DownAI-${version}.dmg`,
  findReleaseDmg,
  process.env.DOWNAI_MAC_DOWNLOAD_URL || 'https://downai.vercel.app/downloads/DownAI-1.0.0.dmg'
);
