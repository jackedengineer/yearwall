/**
 * One toast at a time, at the bottom of the screen, with an optional Undo.
 * The region is always in the page with aria-live, so screen readers announce
 * every message. The timer pauses while the pointer or focus is on the toast.
 */
import { useSyncExternalStore } from 'react';
import { MOTION } from '@core/theme';
import Feather from '@web/lib/icons';

export type Toast = { message: string; undo?: () => void; undoLabel?: string };
type Shown = Toast & { id: number };

let current: Shown | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const stopTimer = () => {
  if (timer) clearTimeout(timer);
  timer = null;
};
const startTimer = () => {
  stopTimer();
  timer = setTimeout(dismissToast, MOTION.toast.visibleMs);
};

export function toast(t: Toast) {
  current = { ...t, id: ++seq };
  notify();
  startTimer();
}

export function dismissToast() {
  stopTimer();
  current = null;
  notify();
}

export function ToastHost() {
  const t = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => current,
  );
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      {t ? (
        <div key={t.id} className="toast" onMouseEnter={stopTimer} onMouseLeave={startTimer} onFocus={stopTimer} onBlur={startTimer}>
          <span className="toast-msg">{t.message}</span>
          {t.undo ? (
            <button
              type="button"
              className="toast-btn"
              onClick={() => {
                const undo = t.undo!;
                undo();
                toast({ message: 'Undone.' });
              }}
            >
              {t.undoLabel ?? 'Undo'}
            </button>
          ) : null}
          <button type="button" className="toast-x" aria-label="Dismiss" onClick={dismissToast}>
            <Feather name="x" size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
