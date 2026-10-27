/**
 * PNG из public/favicon.svg (PWA + apple-touch + favicon-32).
 * Запуск из apps/web: node scripts/generate-favicons.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const svg = readFileSync(join(publicDir, 'favicon.svg'));

const sizes = [
  { file: 'favicon-32.png', size: 32 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icons/icon-72x72.png', size: 72 },
  { file: 'icons/icon-96x96.png', size: 96 },
  { file: 'icons/icon-128x128.png', size: 128 },
  { file: 'icons/icon-144x144.png', size: 144 },
  { file: 'icons/icon-152x152.png', size: 152 },
  { file: 'icons/icon-192x192.png', size: 192 },
  { file: 'icons/icon-384x384.png', size: 384 },
  { file: 'icons/icon-512x512.png', size: 512 },
];

for (const { file, size } of sizes) {
  const out = join(publicDir, file);
  const png = await sharp(svg, { density: 512 })
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(out, png);
  console.log('wrote', file);
}

