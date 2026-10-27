import { existsSync, readdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = join(webRoot, '.angular', 'cache');

if (!existsSync(cacheDir)) {
  process.exit(0);
}

for (const versionDir of readdirSync(cacheDir, { withFileTypes: true })) {
  if (!versionDir.isDirectory()) continue;
  const viteDeps = join(cacheDir, versionDir.name, 'web', 'vite', 'deps');
  if (existsSync(viteDeps)) {
    rmSync(viteDeps, { recursive: true, force: true });
    console.log(`[web] Cleared Vite optimize cache: ${viteDeps}`);
  }
}
