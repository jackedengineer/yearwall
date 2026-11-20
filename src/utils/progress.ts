/**
 * What the habit cards, week drawer, board and share images show: weekly
 * progress, the 7-day strip, habit colours, toast copy, perfect-week runs,
 * year progress, plan outcomes and quarter goals.
 *
 * Pure TypeScript (no React, no React Native): shared by the phone app,
 * the web app and the tests.
 */
import { S } from '../data/state';
import type { GoalItem, GoalKey, Goal, Habit, HabitColor, Plan } from '../data/types';
import { HABIT_COLORS, HABIT_COLOR_IDS } from '../theme';
import { addD, clampWeek, diff, fmt, fmtRange, todayS, weekDays, weekOf, weekStart, WEEKS, YEAR_END, YEAR_START } from './dates';
import { doneOn, isActive, isPerfect, targetOn, valueOn } from './logic';

/* ---------- habit colours ---------- */

/** The habit's colour; habits without one take the colour at their position (wrapping after 6). */
export function habitColorId(h: Habit, list: Habit[] = S.meta.habits): HabitColor {
  if (h.color && HABIT_COLOR_IDS.includes(h.color)) return h.color;
  const i = list.findIndex((x) => x.id === h.id);
  return HABIT_COLOR_IDS[(i < 0 ? list.length : i) % HABIT_COLOR_IDS.length];
}
export const habitColor = (h: Habit, list?: Habit[]) => HABIT_COLORS[habitColorId(h, list)];

/** Colour for a new habit: the first one no current habit uses, else by position. */
export function nextHabitColor(list: Habit[] = S.meta.habits): HabitColor {
  const used = new Set(list.map((h) => habitColorId(h, list)));
  return HABIT_COLOR_IDS.find((c) => !used.has(c)) ?? HABIT_COLOR_IDS[list.length % HABIT_COLOR_IDS.length];
}

/* ---------- weekly progress ---------- */

export type WeekProgress = {
  /** Days done this week, counting up to `ref`. */
  done: number;
  /** Days needed: the habit's days per week, capped at the days it's active that week. */
  target: number;
  left: number;
  met: boolean;
  /** Days the habit is active that week (0 when paused or not started). */
  scheduled: number;
};

/** "n of target this week". `w` defaults to the week holding `ref`. */
export function weekProgress(h: Habit, ref = todayS(), w = clampWeek(weekOf(ref))): WeekProgress {
  const days = weekDays(w).filter((d) => isActive(h, d));
  const target = Math.min(h.daysPerWeek || 7, days.length);
  const done = days.filter((d) => d <= ref && doneOn(h, d)).length;
  return { done, target, left: Math.max(0, target - done), met: target > 0 && done >= target, scheduled: days.length };
}

/**
 * One day in a habit's 7-day strip:
 * - done: target reached
 * - partial: some minutes logged, target not reached
 * - missed: a past day of an every-day habit that wasn't done
 * - empty: not done yet (today), or a free day for a habit with fewer than 7 days a week
 * - future: after today
 * - off: paused, ended, or before the habit started
 */
export type DayState = 'done' | 'partial' | 'missed' | 'empty' | 'future' | 'off';
export type StripDay = { date: string; state: DayState; today: boolean; value: number; target: number };

export function dayState(h: Habit, d: string, ref = todayS()): DayState {
  if (!isActive(h, d)) return 'off';
  if (d > ref) return 'future';
  if (doneOn(h, d)) return 'done';
  if (valueOn(h, d) > 0) return 'partial';
  if (d === ref || (h.daysPerWeek || 7) < 7) return 'empty';
  return 'missed';
}

/** Monday to Sunday of the week holding `ref`. */
export function weekStrip(h: Habit, ref = todayS(), w = clampWeek(weekOf(ref))): StripDay[] {
  return weekDays(w).map((date) => ({ date, state: dayState(h, date, ref), today: date === ref, value: valueOn(h, date), target: targetOn(h, date) }));
}

/** Line under the habit name: "3 of 6 this week" or, for minutes, "30 of 240 min today". */
export function progressLine(h: Habit, d = todayS()) {
  if (!isActive(h, d)) return 'Not scheduled today';
  if (h.type === 'minutes') return `${valueOn(h, d)} of ${targetOn(h, d)} min ${d === todayS() ? 'today' : fmt(d)}`;
  const p = weekProgress(h, d);
  return `${p.done} of ${p.target} this week`;
}

/* ---------- toast copy for logging ---------- */

/**
 * What the toast says after a tap changed a habit's value on day `d` from `before` to `after`.
 * "Deep work logged. 3 of 6 this week, 3 to go." / "Deep work: 30 of 240 min today." / "Deep work unlogged."
 */
export function logMessage(h: Habit, d: string, before: number, after: number, ref = todayS()) {
  const target = targetOn(h, d);
  const when = d === ref ? '' : ` for ${fmt(d, { wd: true })}`;
  if (after <= 0) return `${h.name} unlogged${when}.`;
  if (h.type === 'minutes' && after < target) return `${h.name}: ${after} of ${target} min${d === ref ? ' today' : when}.`;
  if (h.type === 'minutes' && before >= target) return `${h.name}: ${after} min${d === ref ? ' today' : when}.`;
  const p = weekProgress(h, d < ref ? ref : d, clampWeek(weekOf(d)));
  const week = p.target === 0 ? '' : p.left > 0 ? ` ${p.done} of ${p.target} this week, ${p.left} to go.` : ` ${p.done} of ${p.target} this week. Week done.`;
  return `${h.name} logged${when}.${week}`;
}

/* ---------- board ---------- */

/** "Week 1 of 52 · 360 days left · 1% gone" for the chapter year (Nov 16, 2026 to Nov 14, 2027). */
export function yearProgress(ref = todayS()) {
  const total = WEEKS * 7;
  const elapsed = Math.max(0, Math.min(total, diff(YEAR_START, ref) + 1));
  const week = ref < YEAR_START ? 0 : clampWeek(weekOf(ref));
  return { week, weeks: WEEKS, daysLeft: total - elapsed, pct: Math.round((elapsed / total) * 100), started: ref >= YEAR_START, ended: ref > YEAR_END };
}

/** Perfect weeks so far, the longest run of them, and the run ending this week. Weeks with nothing scheduled are skipped. */
export function perfectWeeks(ref = todayS()) {
  if (ref < YEAR_START) return { count: 0, bestRun: 0, currentRun: 0 };
  const last = clampWeek(weekOf(ref > YEAR_END ? YEAR_END : ref));
  let count = 0;
  let run = 0;
  let bestRun = 0;
  for (let w = 1; w <= last; w++) {
    const scheduled = S.meta.habits.some((h) => weekDays(w).some((d) => isActive(h, d)));
    if (!scheduled) continue;
    if (isPerfect(w, ref)) {
      count++;
      run++;
      bestRun = Math.max(bestRun, run);
    } else if (w < last) run = 0; // the week in progress doesn't break a run yet
  }
  return { count, bestRun, currentRun: run };
}

/** Plans touching week `w`, in date order. */
export const plansInWeek = (w: number): Plan[] => {
  const a = weekStart(w);
  const b = addD(a, 6);
  return S.meta.plans.filter((p) => p.start <= b && (p.end || p.start) >= a).sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
};

/** Start and end dates for the chosen weekday chips (0 = Monday) of week `w`. */
export function rangeFromDays(w: number, days: number[]) {
  if (!days.length) return null;
  const s = weekStart(w);
  return { start: addD(s, Math.min(...days)), end: addD(s, Math.max(...days)) };
}

/** "Dec 7–11", "Dec 7", "Dec 30 – Jan 2" */
export const whenLabel = (start: string, end: string) => fmtRange(start, end).replace(/ – (\d+)$/, '–$1');

/* ---------- plan outcomes ---------- */

/** A plan whose last day has passed and nobody has said whether it happened. */
export const needsOutcome = (p: Plan, ref = todayS()) => (p.end || p.start) < ref && !p.outcome;

/* ---------- quarter goals ---------- */

export const MAX_GOALS = 5;
const QUARTER_WEEKS = 13;

/** Quarter 1–4 of the chapter year that holds `ref` (1 before the year starts, 4 after it ends). */
export const quarterOf = (ref = todayS()) => Math.min(4, Math.floor((clampWeek(weekOf(ref)) - 1) / QUARTER_WEEKS) + 1) as 1 | 2 | 3 | 4;
export function quarterRange(q: 1 | 2 | 3 | 4) {
  const start = weekStart((q - 1) * QUARTER_WEEKS + 1);
  return { start, end: addD(weekStart(q * QUARTER_WEEKS), 6) };
}

const goalLines = (text: string) =>
  (text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The checklist for a quarter. `text` mirrors the items (one per line) so older
 * clients still show the goals; when an older client has edited `text`, the
 * checklist is rebuilt from it, keeping ticks on lines that didn't change.
 * A goal saved before checklists existed becomes its first item.
 */
export function goalItems(g: Goal | undefined, q: GoalKey): GoalItem[] {
  if (!g) return [];
  const lines = goalLines(g.text);
  const items = Array.isArray(g.items) ? g.items.filter((i) => i && typeof i.text === 'string' && i.text.trim()) : null;
  if (items && items.map((i) => i.text.trim()).join('\n') === lines.join('\n')) return items.slice(0, MAX_GOALS);
  if (!lines.length) return [];
  // Old text, or text changed by an older client. Lines past the 5th stay together in the 5th item.
  const kept = [...lines.slice(0, MAX_GOALS - 1), lines.slice(MAX_GOALS - 1).join('\n')].filter(Boolean);
  return kept.map((text, n) => items?.find((i) => i.text.trim() === text) ?? { id: `${q}-${n + 1}`, text, done: !!g.done });
}

/** The goal record for a checklist: items plus text/done for older clients. */
export function goalFromItems(items: GoalItem[]): Goal {
  const list = items.filter((i) => i.text.trim()).slice(0, MAX_GOALS).map((i) => ({ ...i, text: i.text.trim() }));
  return { text: list.map((i) => i.text).join('\n'), done: list.length > 0 && list.every((i) => i.done), items: list };
}
