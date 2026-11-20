/**
 * One toast at a time, at the bottom of the screen, with an optional Undo.
 * The region is always in the page with aria-live, so screen readers announce
 * every message. Toasts with Undo stay 10 s (5 s otherwise) and pause while the
 * pointer or focus is on them; Ctrl+Z / Cmd+Z runs the last Undo from anywhere
 * outside a text field, and focus returns to where the action started.
 */
import { useSyncExternalStore } from 'react';
import { MOTION } from '@core/theme';
import Feather from '@web/lib/icons';

export type Toast = { message: string; undo?: () => void; undoLabel?: string };
type Shown = Toast & { id: number };
type Origin = { el: HTMLElement; label: string | null } | null;

let current: Shown | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let ms: number = MOTION.toast.visibleMs;
let lastUndo: { run: () => void; until: number; origin: Origin } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const stopTimer = () => {
  if (timer) clearTimeout(timer);
  timer = null;
};
const startTimer = () => {
  stopTimer();
  timer = setTimeout(dismissToast, ms);
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const undoKeys = isMac ? '⌘Z' : 'Ctrl+Z';

export function toast(t: Toast) {
  const el = document.activeElement as HTMLElement | null;
  const origin: Origin = el && el !== document.body && !el.closest('.toast-region') ? { el, label: el.getAttribute('aria-label') } : null;
  current = { ...t, id: ++seq };
  // Ctrl+Z only ever undoes what the latest toast offered.
  lastUndo = t.undo ? { run: t.undo, until: Date.now() + 60_000, origin } : null;
  ms = t.undo ? MOTION.toast.undoMs : MOTION.toast.visibleMs;
  notify();
  startTimer();
}

export function dismissToast() {
  stopTimer();
  current = null;
  notify();
}

/** Runs the most recent Undo (once), then puts focus back where the action started. */
export function runUndo(): boolean {
  const u = lastUndo;
  if (!u || Date.now() > u.until) return false;
  lastUndo = null;
  u.run();
  toast({ message: 'Undone.' });
  requestAnimationFrame(() => {
    const o = u.origin;
    if (!o) return;
    // The control may have been re-created by the undo: find it again by its label.
    const back = o.el.isConnected ? o.el : o.label ? document.querySelector<HTMLElement>(`[aria-label="${CSS.escape(o.label)}"]`) : null;
    back?.focus({ preventScroll: false });
  });
  return true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
    // In a text field Ctrl+Z keeps its usual meaning.
    if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]')) return;
    if (runUndo()) e.preventDefault();
  });
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
          <span className="toast-msg">
            {t.message}
            {t.undo ? <span className="sr-only"> Press {isMac ? 'Command Z' : 'Control Z'} to undo.</span> : null}
          </span>
          {t.undo ? (
            <>
              <kbd className="toast-kbd" aria-hidden="true">
                {undoKeys}
              </kbd>
              <button type="button" className="toast-btn" onClick={() => runUndo()}>
                {t.undoLabel ?? 'Undo'}
              </button>
            </>
          ) : null}
          <button type="button" className="toast-x" aria-label="Dismiss" onClick={dismissToast}>
            <Feather name="x" size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
