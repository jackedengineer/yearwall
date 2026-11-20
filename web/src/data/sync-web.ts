/**
 * Sync in the browser. The web app keeps no database of its own: each visit
 * loads everything from the server, then syncs every few seconds while the
 * tab is visible. Edits not yet sent are also saved in localStorage, so
 * closing the tab while offline doesn't lose them.
 */
import { useSyncExternalStore } from 'react';
import { keyOf, readRecord, type Kind, type Rec } from '@core/data/records';
import { S, UI } from '@core/data/state';
import { applyRemote, initMemoryStore, seedTemplate, setTouchHandler } from '@core/data/store';
import { createSync, type Sync, type SyncStatus, type SyncStore } from '@core/data/sync';
import { clampWeek, monKey, todayS, weekOf, YEAR_START } from '@core/utils/dates';
import { loadViewState } from '@web/lib/view-state';

const KEY = 'yearwall.syncKey';
const OUTBOX = 'yearwall.outbox';
const EVERY_MS = 5000;

const storage = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: edits still sync while the tab is open */
    }
  },
  del(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

function memorySyncStore() {
  const clocks = new Map<string, { k: Kind; i: string; u: number; dirty: boolean }>();
  let cursor = -1;
  const saveOutbox = () => {
    const recs: Rec[] = [...clocks.values()].filter((c) => c.dirty).map((c) => ({ k: c.k, i: c.i, u: c.u, d: readRecord(c.k, c.i) }));
    if (recs.length) storage.set(OUTBOX, JSON.stringify(recs));
    else storage.del(OUTBOX);
  };
  const store: SyncStore = {
    cursor: () => cursor,
    setCursor(rev) {
      cursor = rev;
    },
    clock: (k, i) => clocks.get(keyOf(k, i))?.u,
    mark(k, i, u, dirty) {
      clocks.set(keyOf(k, i), { k, i, u, dirty });
      if (dirty) saveOutbox();
    },
    dirty: () => [...clocks.values()].filter((c) => c.dirty).map(({ k, i, u }) => ({ k, i, u })),
    clean(k, i, u) {
      const c = clocks.get(keyOf(k, i));
      if (c && c.u === u && c.dirty) {
        c.dirty = false;
        saveOutbox();
      }
    },
    batch: (fn) => fn(),
  };
  return store;
}

let sync: Sync | null = null;
let hooked = false;
let key: string | null = null;
const listeners = new Set<() => void>();
const OFF: SyncStatus = { state: 'off', lastSync: null, message: 'Not connected', pending: 0 };

export type Boot = 'need-key' | 'bad-key' | 'offline' | 'empty' | 'ready';

/** True once the server has a year in it (normally sent by the phone's first sync). */
export const hasData = () => S.meta.chapters.length > 0 || S.meta.habits.length > 0 || S.meta.plans.length > 0 || S.posts.length > 0;

/** Empty server and no phone: start from the Chapter 1 plan, like a fresh phone install. */
export function startFresh() {
  seedTemplate();
}

/** Loads all data from the server. Call on startup and after entering a key. */
export async function boot(): Promise<Boot> {
  sync?.stop();
  initMemoryStore();
  key = storage.get(KEY);
  if (!key) return 'need-key';
  const store = memorySyncStore();
  sync = createSync({ store, endpoint: () => (key ? { url: location.origin, key } : null), adoptLocal: false });
  sync.subscribe(() => listeners.forEach((l) => l()));
  setTouchHandler(sync.touch);

  await sync.syncNow();
  const st = sync.status();
  if (st.state === 'error') {
    storage.del(KEY);
    key = null;
    return 'bad-key';
  }
  if (st.state !== 'ok') return 'offline';

  // Edits from an earlier visit that never reached the server.
  let saved: Rec[] = [];
  try {
    saved = JSON.parse(storage.get(OUTBOX) || '[]');
  } catch {
    saved = [];
  }
  const newer = saved.filter((r) => r.u > (store.clock(r.k, r.i) ?? 0));
  if (newer.length) {
    applyRemote(newer);
    newer.forEach((r) => store.mark(r.k, r.i, r.u, true));
  }
  if (store.dirty().length) await sync.syncNow();

  const t = todayS();
  UI.day = t < YEAR_START ? YEAR_START : t;
  UI.contentWeek = clampWeek(weekOf(t));
  UI.moneyMonth = monKey(t < YEAR_START ? YEAR_START : t);
  loadViewState();

  // Sync every few seconds while the tab is visible, and right away when it comes back.
  sync.start(EVERY_MS);
  const result: Boot = hasData() ? 'ready' : 'empty';
  if (hooked) return result;
  hooked = true;
  document.addEventListener('visibilitychange', () => {
    if (!sync) return;
    if (document.visibilityState === 'visible') sync.start(EVERY_MS);
    else {
      sync.stop();
      void sync.syncNow();
    }
  });
  return result;
}

/** Checks a key with the server and saves it in this browser. */
export async function checkKey(k: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${k}` },
      body: JSON.stringify({ since: 2147483647, push: [] }),
    });
  } catch {
    return "Couldn't reach the server. Check your internet connection.";
  }
  if (res.status === 401) return 'That sync key is wrong.';
  if (!res.ok) return `The server answered with error ${res.status}.`;
  storage.set(KEY, k);
  return null;
}

/** Forgets the key in this browser (data stays on the server and the phone). */
export function signOut() {
  sync?.stop();
  storage.del(KEY);
  storage.del(OUTBOX);
  location.href = '/';
}

export const syncNow = () => sync?.syncNow();

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => sync?.status() ?? OFF,
  );
}
