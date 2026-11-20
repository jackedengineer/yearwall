/**
 * View state that stays in this browser and isn't synced: hidden plan
 * categories, the spotlighted habit and the board view.
 */
import { CATS } from '@core/constants';
import { commit, S, UI } from '@core/data/state';
import type { CatId } from '@core/data/types';

const KEY = 'yearwall.view';

export function loadViewState() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (Array.isArray(v.hideCats)) UI.hideCats = new Set(v.hideCats.filter((c: string) => CATS.some((x) => x.id === c)) as CatId[]);
    if (typeof v.spotlight === 'string') UI.spotlight = v.spotlight;
    if (v.yearView === 'weeks' || v.yearView === 'days') UI.yearView = v.yearView;
  } catch {
    /* nothing saved, or storage blocked */
  }
}

export function saveViewState() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ hideCats: [...UI.hideCats], spotlight: UI.spotlight, yearView: UI.yearView }));
  } catch {
    /* storage blocked: the view still changes for this visit */
  }
}

/** The habit in the spotlight, if it still exists. */
export const spotlightHabit = () => (UI.spotlight ? (S.meta.habits.find((h) => h.id === UI.spotlight) ?? null) : null);

export function setSpotlight(id: string) {
  UI.spotlight = id;
  saveViewState();
  commit();
}

export function toggleCategory(c: CatId) {
  if (UI.hideCats.has(c)) UI.hideCats.delete(c);
  else UI.hideCats.add(c);
  saveViewState();
  commit();
}

export function setYearView(v: 'weeks' | 'days') {
  UI.yearView = v;
  saveViewState();
  commit();
}
