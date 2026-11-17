import { bindings, defineConfig } from 'cf/config';
import * as entrypoint from './worker/index.ts' with { type: 'cf-worker' };

export default defineConfig({
  worker: {
    name: 'yearwall',
    compatibilityDate: '2026-11-16',
    entrypoint,
    observability: { enabled: true },
    assets: {
      // The React app handles its own routes; /api/* goes to the Worker.
      notFoundHandling: 'single-page-application',
      runWorkerFirst: ['/api/*'],
    },
    env: {
      DB: bindings.d1({ name: 'yearwall' }),
      // The key the phone and the browser send. Set it with `npx wrangler secret put SYNC_KEY --name yearwall`.
      SYNC_KEY: bindings.secret(),
    },
  },
});
