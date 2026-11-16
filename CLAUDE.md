# Year Wall: notes for Claude

Personal productivity app (Expo SDK 58, Expo Router, TypeScript, expo-sqlite). Offline-only: there is no backend. The owner tests on a physical Android phone with Expo Go, and the iPhone build comes later.

## Architecture
- `src/data/state.ts`: one in-memory `S` (same JSON shape as the web version's backup) plus `UI` view state. `commit()` notifies screens, and `useStore()` (`src/hooks/use-store.ts`) re-renders on change. Screens read `S` directly.
- `src/data/store.ts`: **every change goes through `actions.*`**. Each action updates `S`, writes the SQLite rows through `repo.ts`, then calls `commit()`. Never mutate `S` from a screen.
- `src/data/repo.ts`: schema plus migrations (`PRAGMA user_version`). To change the schema, add an `if (v < N)` block and never edit `SCHEMA_V1`. It talks to a tiny `Db` adapter, so the same code runs on expo-sqlite (`src/data/db.ts`) and on node:sqlite in tests.
- `src/utils/logic.ts`: pure habit logic (targets that step up by date, pauses, streaks, perfect weeks, board colors). Keep it free of React and React Native imports so `npm test` can run it.
- Dates are local `YYYY-MM-DD` strings, and weeks run Monday to Sunday. Week 1 starts 2026-11-16 (`YEAR_START` in `src/utils/dates.ts`).

## Conventions
- Install packages with `npx expo install <pkg>`, never with npm directly.
- Look: near-black `#090807`, white text, grey day bars, and color only for the five plan categories. Montserrat comes from `@expo-google-fonts/montserrat`. Use `T` from `src/components/ui.tsx` for all text.
- Modal forms are routes in `src/app/*` registered in `src/app/_layout.tsx` with `presentation: 'modal'`.
- Run `npm test` after changing anything in `src/data` or `src/utils`.

## Not verified on a device yet
The first version was written without network access. Packages are now installed at SDK 58 versions, and `npx expo export -p android` bundles cleanly, but the app has not run on a phone yet. Check these first:
`expo-file-system` `File`/`Paths` API (export/import in `src/app/settings.tsx`), `react-native-view-shot` capture size options (`src/app/share.tsx`), and the tab bar styling (`sceneStyle`, `tabBarStyle`).
