/**
 * What happens when you log, archive or delete a habit on the web: the change
 * goes through the shared store actions, then a toast says what happened and
 * offers Undo. Used by habit cards, the sidebar, the week drawer and the editor.
 */
import { S } from '@core/data/state';
import { actions } from '@core/data/store';
import type { Habit } from '@core/data/types';
import { todayS } from '@core/utils/dates';
import { logMessage } from '@core/utils/progress';
import { router } from '@web/lib/router';
import { confirmDialog } from './confirm';
import { toast } from './toast';

/** Ring tap: check habits toggle, minute habits add one step. Returns true when the habit is now done. */
export function logHabit(h: Habit, d: string): boolean {
  const r = actions.tick(h, d);
  if (!r) {
    openTonightsLog(d);
    return false;
  }
  const fresh = S.meta.habits.find((x) => x.id === h.id) ?? h;
  toast({ message: logMessage(fresh, d, r.before, r.after, todayS()), undo: () => actions.setValue(fresh, d, r.before) });
  return r.after > r.before;
}

/** The nightly log ticks itself from the journal, so its ring opens the journal instead. */
export function openTonightsLog(d: string) {
  const focus = () => {
    const el = document.getElementById(`journal-${d}`) as HTMLTextAreaElement | null;
    if (!el) return false;
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
    return true;
  };
  if (!focus()) {
    router.push('/');
    setTimeout(focus, 50);
  }
}

export function archiveHabit(h: Habit) {
  const before = S.meta.habits.find((x) => x.id === h.id);
  if (!before) return;
  actions.archiveHabit(h.id);
  toast({ message: `${h.name} archived. Its history stays.`, undo: () => actions.saveHabit(before) });
}

/** Asks first (Cancel focused). Returns true when the habit was deleted or archived. */
export async function deleteHabit(h: Habit): Promise<boolean> {
  const choice = await confirmDialog({
    title: `Delete ${h.name}?`,
    body: 'It disappears from Today, the board and your stats, along with the days you logged. To stop tracking it but keep its history, archive it instead.',
    actions: [
      { id: 'archive', label: 'Archive instead', kind: 'ghost' },
      { id: 'delete', label: 'Delete habit', kind: 'danger' },
    ],
  });
  if (choice === 'archive') {
    archiveHabit(h);
    return true;
  }
  if (choice === 'delete') {
    actions.deleteHabit(h.id);
    toast({ message: `${h.name} deleted.` });
    return true;
  }
  return false;
}
