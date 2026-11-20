/**
 * Opening a week from the board. On wide screens it opens as a drawer on the
 * side away from what you clicked, so that part of the board stays visible.
 * If a week is already open, the drawer switches weeks instead of stacking
 * another entry, so Close always closes it.
 */
import { clampWeek } from '@core/utils/dates';
import { router } from '@web/lib/router';

export type WeekOpen = { from?: string; to?: string; focus?: 'plan'; x?: number };

export function openWeek(w: number, o: WeekOpen = {}) {
  // Without a pointer position, use the focused element (the week you clicked or pressed Enter on).
  const r = (document.activeElement as HTMLElement | null)?.getBoundingClientRect?.();
  const x = o.x ?? (r ? r.left + r.width / 2 : 0);
  const side = x > window.innerWidth / 2 ? 'left' : 'right';
  const params: Record<string, string> = { w: String(clampWeek(w)), side };
  if (o.from) params.from = o.from;
  if (o.to) params.to = o.to;
  if (o.focus) params.focus = o.focus;
  const href = { pathname: '/week/[w]', params };
  if (location.pathname.startsWith('/week/')) router.replace(href);
  else router.push(href);
}
