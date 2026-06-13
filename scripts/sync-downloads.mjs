import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync } from 'fs';

import { join, dirname } from 'path';

import { fileURLToPath } from 'url';



const __dirname = dirname(fileURLToPath(import.meta.url));

const root = join(__dirname, '..');

const releaseDir = join(root, 'packages/meridian-app/release');

const destDir = join(root, 'packages/meridian-website/public/downloads');



const cloudflareMode = process.argv.includes('--cloudflare');

const downloadBase = (process.env.DOWNAI_DOWNLOAD_BASE_URL || '').replace(/\/$/, '');

const windowsOverride = process.env.DOWNAI_WINDOWS_DOWNLOAD_URL || '';

const macOverride = process.env.DOWNAI_MAC_DOWNLOAD_URL || '';



const pkg = JSON.parse(readFileSync(join(root, 'packages/meridian-app/package.json'), 'utf-8'));

const version = pkg.version;



mkdirSync(destDir, { recursive: true });



function findFile(dir, test) {

  if (!existsSync(dir)) return null;

  for (const name of readdirSync(dir)) {

    const full = join(dir, name);

    if (test(name, full)) return full;

  }

  return null;

}



function formatBytes(bytes) {

  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

}



function resolveUrl(filename, override, sourcePath) {

  if (override) return { url: override, external: true };

  if (downloadBase) return { url: `${downloadBase}/${filename}`, external: true };

  if (cloudflareMode) {

    console.warn(`[cloudflare] No URL for ${filename}. Set DOWNAI_DOWNLOAD_BASE_URL or per-file override.`);

    return { url: `#${filename}`, external: false };

  }

  if (sourcePath && !cloudflareMode) {

    copyFileSync(sourcePath, join(destDir, filename));

    return { url: `/downloads/${filename}`, external: false };

  }

  return { url: `/downloads/${filename}`, external: false };

}



const windowsSource =
  findFile(releaseDir, (n) => n.endsWith('.exe') && /downai/i.test(n)) ||
  findFile(releaseDir, (n) => n.endsWith('.exe'));

const destName = `DownAI-Setup-${version}.exe`;
const destPath = join(destDir, destName);
const windowsExisting = !windowsSource && existsSync(destPath) ? destPath : null;
const windowsFile = windowsSource || windowsExisting;



const macSource =
  findFile(releaseDir, (n) => n.endsWith('.dmg') && /downai/i.test(n)) ||
  findFile(releaseDir, (n) => n.endsWith('.zip') && /downai/i.test(n));



const files = [];



if (windowsFile || windowsOverride) {

  const stat = windowsFile ? statSync(windowsFile) : (existsSync(destPath) ? statSync(destPath) : null);

  const { url, external } = resolveUrl(destName, windowsOverride, windowsSource);



  files.push({

    id: 'windows',

    label: 'Windows',

    filename: destName,

    url,

    external,

    size: stat?.size ?? 0,

    sizeLabel: stat ? formatBytes(stat.size) : '—',

    platform: 'Windows 10/11 · 64-bit',

  });



  if (windowsSource && !cloudflareMode && !downloadBase && !windowsOverride) {

    console.log(`Copied Windows installer → ${destName} (${formatBytes(stat.size)})`);

  } else if (windowsExisting && !windowsOverride) {

    console.log(`Using existing Windows installer → ${destName} (${formatBytes(stat.size)})`);

  } else {

    console.log(`Windows manifest → ${url}${external ? ' (external)' : ''}`);

  }

} else {

  console.warn('No Windows .exe found in release/. Run: npm run build:exe');

}



if (macSource || macOverride) {

  const ext = macSource?.endsWith('.zip') ? 'zip' : 'dmg';

  const destName = `DownAI-${version}.${ext}`;

  const stat = macSource ? statSync(macSource) : null;

  const { url, external } = resolveUrl(destName, macOverride, macSource);



  files.push({

    id: 'mac',

    label: 'macOS',

    filename: destName,

    url,

    external,

    size: stat?.size ?? 0,

    sizeLabel: stat ? formatBytes(stat.size) : '—',

    platform: 'macOS 11+ · Apple Silicon & Intel',

  });



  if (macSource && !cloudflareMode && !downloadBase && !macOverride) {

    console.log(`Copied macOS installer → ${destName} (${formatBytes(stat.size)})`);

  } else {

    console.log(`macOS manifest → ${url}${external ? ' (external)' : ''}`);

  }

} else {

  console.warn('No macOS .dmg found. Build on a Mac: npm run build:mac');

}



const manifest = {

  version,

  updatedAt: new Date().toISOString(),

  files,

};



writeFileSync(join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Wrote manifest.json (${files.length} installer(s))`);

