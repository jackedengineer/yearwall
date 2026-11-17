import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: {
    alias: {
      // Data, sync and habit logic shared with the phone app (../src). Plain TypeScript, no React Native.
      '@core': dir('../src'),
      '@web': dir('./src'),
    },
  },
  server: { fs: { allow: [dir('..')] } },
});
