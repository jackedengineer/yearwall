/**
 * What happens when you log, archive or delete a habit on the phone: the change
 * goes through the shared store actions, then a toast says what happened and
 * offers Undo. Used by the habit cards, the week sheet and the habit editor.
 */
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { commit, S, UI } from '@/data/state';
import { actions } from '@/data/store';
import type { Habit } from '@/data/types';
import { todayS } from '@/utils/dates';
import { doneOn } from '@/utils/logic';
import { logMessage } from '@/utils/progress';
import { toast } from './toast';

/** Ring tap: check habits toggle, minute habits add one step. Returns true when the value went up. */
export function logHabit(h: Habit, d: string): boolean {
  const r = actions.tick(h, d);
  if (!r) {
    openTonightsLog(d);
    return false;
  }
  const fresh = S.meta.habits.find((x) => x.id === h.id) ?? h;
  // One haptic per tap, in the same frame as the ring changing.
  if (r.after > r.before && doneOn(fresh, d)) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  toast({ message: logMessage(fresh, d, r.before, r.after, todayS()), undo: () => actions.setValue(fresh, d, r.before) });
  return r.after > r.before;
}

/* The nightly log ticks itself from the journal, so its ring opens that day's log instead. */
const journalListeners = new Set<(d: string) => void>();
export const onJournalFocus = (fn: (d: string) => void) => {
  journalListeners.add(fn);
  return () => {
    journalListeners.delete(fn);
  };
};
export function openTonightsLog(d: string) {
  UI.day = d;
  commit();
  router.navigate('/');
  setTimeout(() => journalListeners.forEach((fn) => fn(d)), 250);
}

export function archiveHabit(h: Habit) {
  const before = S.meta.habits.find((x) => x.id === h.id);
  if (!before) return;
  actions.archiveHabit(h.id);
  toast({ message: `${h.name} archived. Its history stays.`, undo: () => actions.saveHabit(before) });
}

/** Asks first. Resolves true when the habit was deleted or archived. */
export function deleteHabit(h: Habit): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(
      `Delete ${h.name}?`,
      'It disappears from Today, the board and your stats, along with the days you logged. To stop tracking it but keep its history, archive it instead.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Archive instead',
          onPress: () => {
            archiveHabit(h);
            resolve(true);
          },
        },
        {
          text: 'Delete habit',
          style: 'destructive',
          onPress: () => {
            actions.deleteHabit(h.id);
            toast({ message: `${h.name} deleted.` });
            resolve(true);
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
