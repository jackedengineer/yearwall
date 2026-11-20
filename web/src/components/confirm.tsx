/**
 * A confirmation dialog that replaces window.confirm for anything destructive.
 * Cancel has focus when it opens, Esc cancels, Tab stays inside, and focus
 * goes back to where it was when it closes.
 *
 *   const choice = await confirmDialog({ title, body, actions: [{ id: 'delete', label: 'Delete habit', kind: 'danger' }] });
 *   // choice is the action id, or null for Cancel
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';

export type ConfirmAction = { id: string; label: string; kind?: 'danger' | 'ghost' | 'primary' };
type Request = { title: string; body: string; actions: ConfirmAction[]; cancelLabel?: string; resolve: (id: string | null) => void };

let open: Request | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function confirmDialog(opts: Omit<Request, 'resolve'>): Promise<string | null> {
  open?.resolve(null);
  return new Promise((resolve) => {
    open = { ...opts, resolve };
    notify();
  });
}

function close(id: string | null) {
  const r = open;
  open = null;
  notify();
  r?.resolve(id);
}

export function ConfirmHost() {
  const req = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => open,
  );
  const box = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!req) return;
    const back = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(null);
      } else if (e.key === 'Tab' && box.current) {
        const items = [...box.current.querySelectorAll<HTMLElement>('button')];
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i >= items.length - 1 ? 0 : i + 1;
        e.preventDefault();
        items[next]?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      back?.focus?.();
    };
  }, [req]);

  if (!req) return null;
  return (
    <div className="confirm-overlay" onMouseDown={(e) => e.target === e.currentTarget && close(null)}>
      <div ref={box} className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
        <h2 id="confirm-title">{req.title}</h2>
        <p id="confirm-body">{req.body}</p>
        <div className="confirm-actions">
          <button ref={cancel} type="button" className="btn ghost" onClick={() => close(null)}>
            {req.cancelLabel ?? 'Cancel'}
          </button>
          {req.actions.map((a) => (
            <button key={a.id} type="button" className={`btn ${a.kind ?? 'ghost'}`} onClick={() => close(a.id)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
