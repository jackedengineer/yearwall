# Year Wall web

The web version of Year Wall (plain React + Vite) and the sync server it shares
with the phone app (a Cloudflare Worker with a D1 database), deployed together
as one Worker.

```
src/           React app (screens ported from the phone app, see src/lib/rn.tsx)
src/data/      sync-web.ts: loads everything from the server, syncs every 5 s
worker/        the API: POST /api/sync (index.ts) and its SQL (sync-db.ts)
cloudflare.config.ts   Worker name, D1 binding, SYNC_KEY secret, static assets
```

Data, sync and habit logic are not duplicated: they come from the phone app's
`../src/data` and `../src/utils` (the `@core` alias).

## Develop

```bash
npm install
echo 'SYNC_KEY=local-dev-key' > .dev.vars   # local key, not committed
npm run dev                                  # http://localhost:5173, local D1
npm run typecheck
```

## Deploy

Production: **https://yearwall.jacked.dev** (a Workers Custom Domain on the
`jacked.dev` zone, attached once through the Cloudflare API; `cf deploy` keeps
it). The workers.dev address `yearwall.ichiragbhugra.workers.dev` serves the
same Worker and database.

```bash
npx cf auth login
npm run deploy
```

The sync key is a Worker secret. To change it:
`npx wrangler secret put SYNC_KEY --name yearwall`, then enter the new key in
the phone app (Settings, Sync) and in each browser.
