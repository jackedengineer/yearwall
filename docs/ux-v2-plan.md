You're continuing work on Year Wall (repo: github.com/jackedengineer/yearwall, branch main is live). Read CLAUDE.md first; its rules apply. Before writing code, save this whole message as docs/ux-v2-plan.md on a new branch `ux-v2`, then work through it in order.

## Context
- Year Wall is my personal year tracker: Expo SDK 58 phone app (Android, EAS APK) plus a Vite + React web app in web/ served by a Cloudflare Worker + D1 at https://yearwall.jacked.dev. Phone and web sync through POST /api/sync (bearer SYNC_KEY). Shared logic lives in src/data and src/utils (the web app imports it through the @core alias).
- Live data (written Nov 20): Chapter 1 "First Principles" (Nov 20 to Dec 31, 2026), Day 0 = 2026-11-20. Habits: h_deep (Deep work, 240 min, 6 days a week, paused Nov 27 to Dec 3 and Dec 6 to 8), h_teach (check, 5 days a week), h_books (Read 20 min), h_yoga (15 min), h_med (10 min), h_log (Nightly log, auto: journal). There are 9 plans, 7 week focuses and 24 posts. src/data/template.ts still holds the old "Stillness" plan; update it to First Principles as part of this work.
- I find the current flow confusing ("where do I set things, check them off, see streaks"). The goal is to make logging and planning obvious and satisfying, inspired by ChaiCode's Year board (labs.chaicode.com/year), without losing what Year Wall does better: minute habits that step up, pauses that don't break streaks, chapters with tests, the content plan, the journal, money and sync.

## What ChaiCode does well (borrow)
- Habit card: a large round tick button on the left; name; flame and streak; a 7-segment strip for this week with today as a larger outlined capsule; "1 of 3 this week"; an eye button; a ··· menu (Edit, Archive, Delete).
- Ticking: one tap fills the ring with the habit's colour.
  - Pop animation: scale 0.85 → 1.08 → 1, 260 ms, cubic-bezier(0.3, 1.4, 0.6, 1).
  - The card gets a tint and border in the habit's colour; colour transitions take 150 ms.
  - A toast slides up (translateY 10px → 0, scale 0.98 → 1): "Gym logged. 1 of 3 this week, 2 to go."
- Add a habit: name, one of 6 colours, weekly target as a 1–7 segmented control.
- Delete: a custom dialog with Cancel focused by default ("This deletes the habit and every day you logged… archive it instead").
- Week opens as a drawer beside the board, on the side away from the week you clicked, so the board stays visible.
  - ← → between weeks, × and Esc to close. "This week" scrolls to the current week and opens it.
  - Drawer contents: week focus ("shows on the board"); a habit grid (M–S × habits, "1/3" per habit); quick add-plan; a day-by-day plan list with × on each plan; notes ("Wins, misses, reminders for this week").
- Quick add-plan: title, "When:" Mon–Sun chips, category chips (Work, Learning, Health, Travel, Personal), one Add button.
- Dragging across days on the board highlights the range and opens the drawer with "When: Dec 7–11" filled in and the title focused.
- Past plans ask "Did it happen? Yes / No", then show ✓ with an inline undo (planned against done).
- Spotlight (eye): the board shows one habit. Done days fill with its colour, each past week shows "n of target", plans dim, and a caption explains how to leave.
- Year progress bar: "Week 47 of 53 · 41 days left · 89% gone".
- Category filter chips ("Show"): a hidden category greys out with a strikethrough, and its plans leave the board and shared images.
- Perfect weeks card: green-tinted, with the count, "best run n weeks" and a one-line definition.
- Quarter goals: up to 5 per quarter. Enter adds a goal and keeps the field focused for the next. A circle ticks it off (strikethrough), × removes it. The current quarter is outlined "Now", past ones say "Done".
- An 11-step coach-mark tour spotlights the real UI: a step count, dots, Back and Next, short second-person copy. It can be replayed from "How it works".
- Share dialog: Week, Month and Year tabs with a live preview (week day cards, a month calendar, a year contribution grid, a legend, habit stat chips). Options: hide plan titles, include habit stats, colour days by habits or plans. Outputs: download image and a public view-only link.
- Empty year: "2026 is a blank wall. Fill it in." with two buttons. A collapsed sidebar leaves a rail of habit tick buttons.
- Accessibility: descriptive labels ("Log X for today", "Open week 47, Nov 16–22, 2 plans", "Add plan on Mon Dec 29"), aria-pressed, focus-visible rings, Esc closes menus and panels, prefers-reduced-motion turns the animations off.

## What ChaiCode does badly (don't copy)
- The toast has no Undo, removing a plan can't be undone, and unticking gives no feedback.
- Habits are yes/no only (keep our minute habits).

## Decisions
- Build all four bundles below. Web ships first, then the Android app. Write shared logic once in src/data and src/utils.
- Each habit gets its own colour, one of 6: green, violet, blue, amber, pink, teal. Update CLAUDE.md's "Look" rule, which currently allows colour only for the five plan categories.
- Work on branch ux-v2 and open a PR. Don't deploy to production until all checks pass and I approve.

## Data changes (additive; older clients must keep working)
- Habit.color?: HabitColor. Without it, a colour comes from the habit's position.
  - Risk: the current phone app saves habits through SQLite columns and drops unknown fields, so it would lose a colour if it edited that habit. Add the colour to the phone schema (v3, via an `if (v < 3)` block) with the phone release.
- Plan.outcome?: 'done' | 'missed'.
- goal record: keep {text, done} for old clients and add items?: {id, text, done}[] (max 5). Migrate an existing text into the first item.
- No new record kinds (the server's KINDS list is fixed).
- View state stays on the device and isn't synced: category filter, spotlighted habit, density.

## Bundles
1. One-tap habit cards (Today, and a sidebar on wide web screens)
   - Layout: ring, name, streak, 7-day strip, "n of target this week" (or "n of target min today" for minute habits).
   - Tapping the ring toggles a check habit or adds one block (step) to a minute habit. Tapping the number still opens exact-minutes entry.
   - Done state: colour fill, tint, the pop animation, and haptics on the phone.
   - Toast with Undo: "Deep work logged. 3 of 6 this week, 3 to go." Unticking shows "Unlogged." The toast is aria-live.
2. Week drawer and fast plans
   - Web drawer and phone sheet with the contents above. Past days in the habit grid are tickable back to Day 0.
   - Quick add with Mon–Sun chips. Drag across days to plan (web, Weeks and Days views).
   - "Did it happen?" with undo. Removing a plan gives an undo toast.
3. Year board insights: habit spotlight, year progress bar (chapter year Nov 16, 2026 to Nov 14, 2027, 52 weeks), category filter, perfect weeks card with best run.
4. Goals, tour and sharing
   - Quarter-goal checklist.
   - A coach-mark tour of about 9 steps that replaces the intro screens and can be replayed from Settings and a "How it works" button. Steps: Today and ticking, streaks and the week strip, the board, opening a week, drag to plan, spotlight, perfect weeks, goals, sharing.
   - Share: add a Month tab and the three options. A public link comes later (it needs a server route).

## Process
- Use these skills if they're available: expo-overview, expo-design-system (habit-colour and motion tokens shared by web and phone), frontend-design, design:ux-copy, engineering:testing-strategy, expo-animation and expo-ui (phone port), design:accessibility-review, engineering:code-review (run by a separate agent that didn't write the code), engineering:deploy-checklist.
- Tests in scripts/data.test.mjs (Node and the real server SQL). Cover:
  - weekly progress
  - week-strip states
  - default habit colours
  - plan outcomes
  - goal items and the migration from text
  - old-shape records still loading
  - an old phone and the new web app syncing the same habit
- Web checks: npm test; in web/, npm run typecheck, npm run lint and npm run build. Click through every new flow on npm run dev with screenshots at 1440 px and 390 px, and check reduced motion.
- Before any deploy, back up the live records: POST /api/sync with {"since":0,"push":[]} from a browser that has the sync key saved (localStorage "yearwall.syncKey" on yearwall.jacked.dev; I have it in my Chrome). Keep the JSON. After deploying (cd web && npm run deploy), check the live site and that the phone still syncs.

## Order
1. Shared logic, data changes and tests
2. Habit cards and toast
3. Week drawer, quick add and drag to plan
4. Plan outcomes
5. Spotlight, progress bar and filters
6. Goals
7. Tour
8. Sharing
9. Independent review, PR, then deploy the web app with my approval
10. Phone port and schema v3, then an EAS build

Keep me posted with short progress notes at each step, and ask before anything irreversible.
