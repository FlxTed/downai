import sharp from 'sharp';
import { readFileSync, copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svg = readFileSync(join(root, 'packages/meridian-app/assets/logo.svg'));

const outDir = join(root, 'packages/meridian-app/public');
mkdirSync(outDir, { recursive: true });

async function renderPng(size) {
  return sharp(svg, { density: Math.min(192, Math.max(72, size * 2)) })
    .resize(size, size, { fit: 'contain', background: { r: 10, g: 10, b: 10, alpha: 1 } })
    .png({
      compressionLevel: 9,
      palette: size <= 64,
    })
    .toBuffer();
}

const pngSizes = [512, 256, 128, 64, 32];
for (const size of pngSizes) {
  const png = await renderPng(size);
  const filename = size === 512 ? 'icon.png' : `icon-${size}.png`;
  writeFileSync(join(outDir, filename), png);
}

copyFileSync(
  join(root, 'packages/meridian-app/assets/logo.svg'),
  join(outDir, 'logo.svg')
);

const websitePublic = join(root, 'packages/meridian-website/public');
mkdirSync(websitePublic, { recursive: true });

copyFileSync(join(outDir, 'icon.png'), join(websitePublic, 'icon.png'));
copyFileSync(
  join(root, 'packages/meridian-app/assets/logo.svg'),
  join(websitePublic, 'logo.svg')
);
copyFileSync(
  join(root, 'packages/meridian-app/assets/logo-mark.svg'),
  join(websitePublic, 'logo-mark.svg')
);

console.log('Icons generated: icon.png and size variants (electron-builder converts to .ico).');
