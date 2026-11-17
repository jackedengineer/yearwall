/**
 * Sync on the phone: wires the shared engine (sync.ts) to SQLite bookkeeping
 * (sync-local.ts), app foreground/background, and the Settings screen.
 * The app works the same with sync off; edits made while offline or
 * disconnected are kept and sent once it can reach the server.
 */
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as repo from './repo';
import { setTouchHandler } from './store';
import { createSync, type Endpoint, type Sync, type SyncStatus } from './sync';
import { saveEndpoint, savedEndpoint, sqliteSyncStore } from './sync-local';

/** The Year Wall server (Cloudflare Worker in web/). */
export const DEFAULT_SERVER = 'https://yearwall.ichiragbhugra.workers.dev';
const EVERY_MS = 10_000;

let sync: Sync | null = null;
let endpoint: Endpoint | null = null;
let unsubscribe: (() => void) | null = null;
const listeners = new Set<() => void>();
const OFF: SyncStatus = { state: 'off', lastSync: null, message: 'Not connected', pending: 0 };
const notify = () => listeners.forEach((l) => l());

function build() {
  sync?.stop();
  unsubscribe?.();
  endpoint = savedEndpoint();
  sync = createSync({ store: sqliteSyncStore(), endpoint: () => endpoint });
  setTouchHandler(sync.touch);
  unsubscribe = sync.subscribe(notify);
  if (endpoint && AppState.currentState === 'active') sync.start(EVERY_MS);
  notify();
}

let started = false;
/** Call once, after initStore(). */
export function startSync() {
  if (started) return;
  started = true;
  build();
  AppState.addEventListener('change', (st) => {
    if (!sync || !endpoint) return;
    if (st === 'active') sync.start(EVERY_MS);
    else {
      sync.stop();
      void sync.syncNow(); // send anything left before the app goes to sleep
    }
  });
}

/** Checks the key with the server, saves it, and runs the first sync. */
export async function connect(url: string, key: string) {
  const ep = { url: url.trim().replace(/\/+$/, ''), key: key.trim() };
  let res: Response;
  try {
    // A cursor far in the future returns no records, so this only checks the key.
    res = await fetch(ep.url + '/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ep.key}` },
      body: JSON.stringify({ since: 2147483647, push: [] }),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check the address and your internet connection.");
  }
  if (res.status === 401) throw new Error('That sync key is wrong.');
  if (!res.ok) throw new Error(`The server answered with error ${res.status}.`);
  const old = savedEndpoint();
  // Switching to a different server or key: start sync bookkeeping from scratch.
  if (old && (old.url !== ep.url || old.key !== ep.key)) repo.syncReset();
  saveEndpoint(ep);
  build();
  await sync?.syncNow();
}

/** Stops syncing. Data stays on the phone; reconnecting sends what changed meanwhile. */
export function disconnect() {
  saveEndpoint(null);
  build();
}

export const syncNow = () => sync?.syncNow();
export const connectedTo = () => endpoint;

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => (endpoint ? sync?.status() ?? OFF : OFF),
  );
}
