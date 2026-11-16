import { CAT } from '../constants';
import { S, UI } from '../data/state';
import type { Chapter, Habit, JournalEntry, Plan, Test } from '../data/types';
import { addD, clampWeek, diff, ds, monKey, pd, todayS, weekDays, weekOf, YEAR_END, YEAR_START, WEEKS, weekStart } from './dates';

export const habits = () => S.meta.habits;

export function isActive(h: Habit, d: string) {
  if (d < h.activeFrom) return false;
  if (h.activeTo && d > h.activeTo) return false;
  return !(h.pauses || []).some((p) => d >= p.from && d <= p.to);
}

export function targetOn(h: Habit, d: string) {
  if (h.type === 'check') return 1;
  const sorted = (h.targets || []).slice().sort((a, b) => (a.from < b.from ? -1 : 1));
  let v = sorted[0]?.value ?? 1;
  sorted.forEach((t) => {
    if (t.from <= d) v = t.value;
  });
  return Math.max(1, Number(v) || 1);
}

export function journalOn(d: string): JournalEntry | null {
  return S.journal[monKey(d)]?.[d] ?? null;
}

export function valueOn(h: Habit, d: string) {
  if (h.auto === 'journal') {
    const j = journalOn(d);
    return j && ((j.text || '').trim() || (j.feynman || '').trim()) ? 1 : 0;
  }
  return Number(S.logs[monKey(d)]?.[d]?.[h.id]) || 0;
}

export const doneOn = (h: Habit, d: string) => valueOn(h, d) >= targetOn(h, d);

/** Share of active habits done that day, or null when no habit is scheduled. */
export function dayScore(d: string) {
  const act = habits().filter((h) => isActive(h, d));
  if (!act.length) return null;
  return act.filter((h) => doneOn(h, d)).length / act.length;
}

/** true/false when the habit was scheduled that week, null when it wasn't. */
export function weekHit(h: Habit, w: number, today = todayS()) {
  const days = weekDays(w).filter((d) => isActive(h, d));
  if (!days.length) return null;
  const need = Math.min(h.daysPerWeek || 7, days.length);
  return days.filter((d) => d <= today && doneOn(h, d)).length >= need;
}

export function isPerfect(w: number, today = todayS()) {
  const res = habits()
    .map((h) => weekHit(h, w, today))
    .filter((x) => x !== null);
  return res.length > 0 && res.every(Boolean);
}

export function streak(h: Habit, ref = todayS()): { n: number; unit: 'day' | 'week' } {
  if ((h.daysPerWeek || 7) >= 7) {
    let n = 0;
    let d = ref;
    let guard = 0;
    if (isActive(h, d) && doneOn(h, d)) n++;
    d = addD(d, -1);
    while (d >= h.activeFrom && guard++ < 800) {
      if (isActive(h, d)) {
        if (doneOn(h, d)) n++;
        else break;
      }
      d = addD(d, -1);
    }
    return { n, unit: 'day' };
  }
  let n = 0;
  let w = clampWeek(weekOf(ref));
  if (weekHit(h, w, ref)) n++;
  for (w = w - 1; w >= 1; w--) {
    const r = weekHit(h, w, ref);
    if (r === null) continue;
    if (r) n++;
    else break;
  }
  return { n, unit: 'week' };
}

export function yearStats(today = todayS()) {
  const last = today > YEAR_END ? YEAR_END : today;
  let active = 0;
  let best = 0;
  const runs: Record<string, number> = {};
  for (let d = YEAR_START; d <= last; d = addD(d, 1)) {
    let any = false;
    habits().forEach((h) => {
      if (!isActive(h, d)) return;
      if (doneOn(h, d)) {
        any = true;
        runs[h.id] = (runs[h.id] || 0) + 1;
        best = Math.max(best, runs[h.id]);
      } else if (d !== today) runs[h.id] = 0;
    });
    if (any) active++;
  }
  let perfect = 0;
  const cw = clampWeek(weekOf(last));
  if (last >= YEAR_START) for (let w = 1; w <= cw; w++) if (isPerfect(w, today)) perfect++;
  return { active, best, perfect };
}

const hexMix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
export { hexMix };

export function barColor(d: string, today = todayS()) {
  if (d > today) return '#171514';
  const sc = dayScore(d);
  if (sc === null) return '#1B1918';
  if (sc === 0) return '#24211F';
  if (sc >= 1) return '#ECE8E2';
  return hexMix('#4A4642', '#B9B4AE', sc);
}

export const plansOn = (d: string): Plan[] => S.meta.plans.filter((p) => d >= p.start && d <= (p.end || p.start));

export function capOn(d: string) {
  const ps = plansOn(d).filter((p) => !UI.hideCats.has(p.cat));
  return ps.length ? CAT[ps[ps.length - 1].cat]?.color ?? null : null;
}

export const sortedChapters = () => S.meta.chapters.slice().sort((a, b) => (a.start < b.start ? -1 : 1));
export const chapterAt = (d: string): Chapter | null => S.meta.chapters.find((c) => d >= c.start && d <= c.end) ?? null;
export const nextChapter = (d: string): Chapter | null => sortedChapters().find((c) => c.start > d) ?? null;
export const phaseAt = (c: Chapter, d: string) => (c.phases || []).find((p) => d >= p.start && d <= p.end) ?? null;
export const nextMilestone = (d: string): Plan | null =>
  S.meta.plans.filter((p) => p.milestone && p.start > d).sort((a, b) => (a.start < b.start ? -1 : 1))[0] ?? null;

export function chapterLabelForMonth(y: number, m: number) {
  const first = ds(new Date(y, m, 1));
  const last = ds(new Date(y, m + 1, 0));
  return sortedChapters()
    .filter((c) => c.start <= last && c.end >= first)
    .map((c) => c.name)
    .join(', ');
}

/** Months of the chapter year; a week belongs to the month holding its Thursday. */
export function monthsOfYear() {
  const out: { y: number; m: number; weeks: number[] }[] = [];
  const by: Record<string, (typeof out)[number]> = {};
  for (let w = 1; w <= WEEKS; w++) {
    const thu = pd(addD(weekStart(w), 3));
    const key = `${thu.getFullYear()}-${thu.getMonth()}`;
    if (!by[key]) {
      by[key] = { y: thu.getFullYear(), m: thu.getMonth(), weeks: [] };
      out.push(by[key]);
    }
    by[key].weeks.push(w);
  }
  return out;
}

/** The 13 calendar months the chapter year touches, as 'YYYY-MM'. */
export function moneyMonths() {
  const s = pd(YEAR_START);
  return Array.from({ length: 13 }, (_, i) => ds(new Date(s.getFullYear(), s.getMonth() + i, 1)).slice(0, 7));
}

export function testProgress(t: Test) {
  if (t.baseline == null || t.target == null || t.latest == null) return 0;
  const span = t.target - t.baseline;
  if (span === 0) return 1;
  return Math.max(0, Math.min(1, (t.latest - t.baseline) / span));
}

export function money(n: number) {
  return (S.meta.settings.currency || '₹') + Math.round(n || 0).toLocaleString('en-IN');
}

export const dayIndex = (d: string) => diff(YEAR_START, d);
