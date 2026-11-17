# Year Wall

A personal, offline-first app for running a year of skill chapters: your whole year on one wall, daily habits that light it up, chapters with finish-line tests, a content planner and an income log. Built with Expo (React Native) and SQLite on the phone, plus a React web app. The two stay in sync through a small server on Cloudflare (a Worker with a D1 database).

## Run it on your Android phone

You need Node 20+ on your computer and the **Expo Go** app on your phone (Play Store).

```bash
git clone https://github.com/jackedengineer/yearwall.git
cd yearwall
npm run setup        # installs every package at the version that matches the Expo SDK
npx expo start       # scan the QR code with Expo Go
```

The phone and computer must be on the same Wi-Fi. If they aren't, run `npx expo start --tunnel`.

If Expo Go says the project's SDK is not supported, your Expo Go is newer than the project. Update the project with `npx expo install expo@latest && npx expo install --fix`, then start again.

## Install it as a real app (APK)

```bash
npm install -g eas-cli
eas login
eas init                                   # links the project to your Expo account (once)
eas build -p android --profile preview     # builds an APK in the cloud
```

Open the link EAS gives you on your phone to install the APK. For Google Play, `eas build -p android --profile production` makes an app bundle and `eas submit -p android` uploads it to the internal testing track. The Android package name is `com.yearwall.app` (set in `app.json`). Change it before your first Play upload if you want a different one, because Play never lets you change it afterwards.

## Web app and sync

The web app is at **https://yearwall.jacked.dev** (the same Worker also answers at yearwall.ichiragbhugra.workers.dev). Phone and web share one sync key (there are no accounts):

1. Phone: **Settings → Sync**, enter the sync key, tap **Connect**. The phone's data goes to the server.
2. Browser: open the web app and enter the same key. It loads everything from the server.

Connect the phone first. The web app waits for the phone's data and never sends its own empty defaults.

How it works:

- The phone saves every change to SQLite first, so it works offline. While the app is open it syncs every 10 seconds, when it comes back to the foreground, and about a second after each edit. Changes made offline are sent once it's back online.
- The web app loads everything from the server on each visit and syncs every 5 seconds while the tab is visible. Edits that haven't been sent yet are kept in the browser in case the tab closes while offline.
- Each plan, habit, post, day log and so on is one sync record with the time it was last edited. If the same record was edited on both sides between syncs, **the later edit wins**.
- The server (`web/worker/`) stores records as JSON in D1 and hands out changes since each device's last sync. Every request needs the sync key.

The web app and server live in `web/` (see `web/README.md`). They reuse `src/data` and `src/utils`, so the habit logic, streaks and targets are identical on both.

## Where the data lives

On the phone: one SQLite file, `yearwall.db`, in the app's private storage. The app loads it into memory at startup and writes every change straight back. With sync on, a copy also lives in the `yearwall` D1 database on Cloudflare.

Tables: `settings`, `chapters`, `phases`, `tests`, `habits`, `habit_targets`, `habit_pauses`, `logs`, `plans`, `weeks`, `goals`, `posts`, `journal`, `income`. The schema lives in `src/data/repo.ts`, with versioned migrations (`PRAGMA user_version`).

**Backups:** Settings (on the phone and on the web) has **Export backup** (a JSON file) and **Import backup**. With sync on, importing a backup replaces the data everywhere.

## Project layout

```
src/app/            routes (Expo Router): (tabs)/ and the modal forms
src/screens/        Today, Year, Chapter, Content, Money
src/components/     ui.tsx (shared UI kit), share-cards.tsx (share images)
src/data/           types, in-memory state, SQLite repo, store actions, Chapter 1 template,
                    records.ts + sync.ts (sync engine shared with the web), sync-local.ts + sync-app.ts (phone side)
src/utils/          dates.ts, logic.ts (streaks, perfect weeks, board helpers)
web/                React web app (src/) and the sync server (worker/), deployed together to Cloudflare
scripts/            setup.sh, test.sh, data.test.mjs
```

## Tests

`npm test` type-checks the data layer and runs it against a real SQLite database (Node's built-in `node:sqlite`, Node 22.5+). It covers seeding, reloading, streaks, pauses, weekly targets, perfect weeks, backup export/import, and sync: the phone's sync engine runs against the real server code (`web/worker/sync-db.ts`) on `node:sqlite`, including conflicts, deletions, a fresh phone joining, and a wrong key.

For the web app: `cd web && npm run typecheck`.
