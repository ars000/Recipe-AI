import { defineConfig } from 'vite';

/** Dev-server: pre-bundle workspace shared + CJS deps to avoid 504 Outdated Optimize Dep. */
export default defineConfig({
  optimizeDeps: {
    include: [
      '@recipe-manager/shared',
      '@recipe-manager/shared/ingredient-catalog-match',
      'qrcode',
    ],
  },
});
