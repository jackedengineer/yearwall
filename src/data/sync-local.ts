/**
 * Sync bookkeeping for the phone, kept in SQLite (tables sync_records and
 * sync_meta, see repo.ts) with an in-memory copy for fast lookups.
 */
import { keyOf, type Kind } from './records';
import * as repo from './repo';
import type { Endpoint, SyncStore } from './sync';

export function sqliteSyncStore(): SyncStore {
  const clocks = new Map<string, { k: Kind; i: string; u: number; dirty: boolean }>();
  repo.syncLoad().forEach((r) => clocks.set(keyOf(r.kind as Kind, r.id), { k: r.kind as Kind, i: r.id, u: r.updated_at, dirty: !!r.dirty }));
  let cursor = Number(repo.syncMetaGet('cursor') ?? -1);

  return {
    cursor: () => cursor,
    setCursor(rev) {
      cursor = rev;
      repo.syncMetaSet('cursor', String(rev));
    },
    clock: (k, i) => clocks.get(keyOf(k, i))?.u,
    mark(k, i, u, dirty) {
      clocks.set(keyOf(k, i), { k, i, u, dirty });
      repo.syncMark(k, i, u, dirty);
    },
    dirty: () => [...clocks.values()].filter((c) => c.dirty).map(({ k, i, u }) => ({ k, i, u })),
    clean(k, i, u) {
      const c = clocks.get(keyOf(k, i));
      if (c && c.u === u && c.dirty) {
        c.dirty = false;
        repo.syncClean(k, i, u);
      }
    },
    batch: repo.batch,
  };
}

/** Server address and sync key saved on this phone (never synced). */
export function savedEndpoint(): Endpoint | null {
  const url = repo.syncMetaGet('url');
  const key = repo.syncMetaGet('key');
  return url && key ? { url, key } : null;
}

export function saveEndpoint(ep: Endpoint | null) {
  repo.batch(() => {
    repo.syncMetaSet('url', ep?.url ?? null);
    repo.syncMetaSet('key', ep?.key ?? null);
  });
}
