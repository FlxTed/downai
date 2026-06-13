import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const releaseDir = join(root, 'packages/meridian-app/release');
const destDir = join(root, 'packages/meridian-website/public/downloads');

const pkg = JSON.parse(readFileSync(join(root, 'packages/meridian-app/package.json'), 'utf-8'));
const version = pkg.version ?? '1.0.0';
const destName = `DownAI-Setup-${version}.exe`;
const destPath = join(destDir, destName);

function findReleaseExe() {
  if (!existsSync(releaseDir)) return null;
  for (const name of readdirSync(releaseDir)) {
    if (!name.endsWith('.exe')) continue;
    if (/downai/i.test(name)) return join(releaseDir, name);
  }
  for (const name of readdirSync(releaseDir)) {
    if (name.endsWith('.exe')) return join(releaseDir, name);
  }
  return null;
}

mkdirSync(destDir, { recursive: true });

if (existsSync(destPath) && statSync(destPath).size > 1024 * 1024) {
  console.log(`[prepare-vercel-build] Installer present → ${destName}`);
} else {
  const source = findReleaseExe();
  if (source) {
    copyFileSync(source, destPath);
    console.log(`[prepare-vercel-build] Copied ${source} → ${destName}`);
  } else {
    const fallbackUrl =
      process.env.DOWNAI_WINDOWS_DOWNLOAD_URL ||
      'https://downai.vercel.app/downloads/DownAI-Setup-1.0.0.exe';

    console.warn(`[prepare-vercel-build] No local installer. Fetching ${fallbackUrl}`);
    const res = await fetch(fallbackUrl);
    if (!res.ok) {
      console.error('[prepare-vercel-build] Could not fetch installer. Run: npm run build:exe && npm run sync-downloads');
      process.exit(1);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1024 * 1024) {
      console.error('[prepare-vercel-build] Downloaded file looks too small.');
      process.exit(1);
    }

    writeFileSync(destPath, buffer);
    console.log(`[prepare-vercel-build] Downloaded ${destName} (${(buffer.length / (1024 * 1024)).toFixed(1)} MB)`);
  }
}
