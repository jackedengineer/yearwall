import * as SQLite from 'expo-sqlite';
import type { Db } from './repo';

/** Opens yearwall.db (inside the app's private storage on the phone) and wraps it for repo.ts. */
export function openDb(): Db {
  const db = SQLite.openDatabaseSync('yearwall.db');
  db.execSync('PRAGMA journal_mode = WAL;');
  return {
    exec: (sql) => db.execSync(sql),
    run: (sql, params = []) => {
      db.runSync(sql, params);
    },
    all: (sql, params = []) => db.getAllSync(sql, params) as any[],
    tx: (fn) => db.withTransactionSync(fn),
  };
}
