# Year Wall

A personal, offline-first app for running a year of skill chapters: your whole year on one wall, daily habits that light it up, chapters with finish-line tests, a content planner and an income log. Built with Expo (React Native) and SQLite. All data stays on the phone.

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

## Where the data lives

One SQLite file, `yearwall.db`, in the app's private storage on the phone. There is no server and no account. The app loads it into memory at startup and writes every change straight back.

Tables: `settings`, `chapters`, `phases`, `tests`, `habits`, `habit_targets`, `habit_pauses`, `logs`, `plans`, `weeks`, `goals`, `posts`, `journal`, `income`. The schema lives in `src/data/repo.ts`, with versioned migrations (`PRAGMA user_version`).

**Backups:** Settings has **Export backup** (a JSON file you can save to Drive or Files) and **Import backup**. The format is the same as the web version's backup, so you can move data between them.

## Project layout

```
src/app/            routes (Expo Router): (tabs)/ and the modal forms
src/screens/        Today, Year, Chapter, Content, Money
src/components/     ui.tsx (shared UI kit), share-cards.tsx (share images)
src/data/           types, in-memory state, SQLite repo, store actions, Chapter 1 template
src/utils/          dates.ts, logic.ts (streaks, perfect weeks, board helpers)
scripts/            setup.sh, test.sh, data.test.mjs
```

## Tests

`npm test` type-checks the data layer and runs it against a real SQLite database (Node's built-in `node:sqlite`, Node 22.5+). It covers seeding, reloading, streaks, pauses, weekly targets, perfect weeks, and backup export/import, including backups from the web version.
