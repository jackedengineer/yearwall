/**
 * Drag across days on the Year board to plan them: the range lights up, and
 * on release the week opens with "When" filled in and the title focused.
 * Any element with data-date inside the board takes part (week bars and day
 * cells). A plain click still does what it did before. Mouse and pen only:
 * on touch screens the board keeps scrolling normally.
 */
import { useEffect, type RefObject } from 'react';

export function useDragToPlan(ref: RefObject<HTMLElement | null>, onRange: (start: string, end: string, x: number) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: string | null = null;
    let end: string | null = null;
    let moved = false;
    let swallowClick = false;

    const dateAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-date]')?.dataset.date ?? null;
    const paint = () => {
      const a = start && end ? (start < end ? start : end) : null;
      const b = start && end ? (start < end ? end : start) : null;
      el.querySelectorAll<HTMLElement>('[data-date]').forEach((n) => {
        const d = n.dataset.date!;
        n.classList.toggle('drag-sel', moved && !!a && !!b && d >= a && d <= b);
      });
    };
    const reset = () => {
      start = end = null;
      moved = false;
      paint();
      el.classList.remove('dragging');
    };

    const down = (e: PointerEvent) => {
      // A drag that ended outside the board never got its click: don't eat this one.
      swallowClick = false;
      if (e.pointerType === 'touch' || e.button !== 0) return;
      const d = (e.target as HTMLElement).closest<HTMLElement>('[data-date]')?.dataset.date;
      if (!d) return;
      start = end = d;
      moved = false;
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const d = dateAt(e.clientX, e.clientY);
      if (!d || d === end) return;
      end = d;
      if (end !== start) {
        moved = true;
        el.classList.add('dragging');
        window.getSelection()?.removeAllRanges();
      }
      paint();
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const a = start < end! ? start : end!;
      const b = start < end! ? end! : start;
      const dragged = moved;
      reset();
      if (dragged) {
        swallowClick = true;
        // The click (if any) arrives right after pointerup; after that, stop swallowing.
        setTimeout(() => {
          swallowClick = false;
        }, 0);
        onRange(a, b, e.clientX);
      }
    };
    // The click that ends a drag shouldn't also open the day or week under the pointer.
    const click = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && start) reset();
    };

    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', reset);
    window.addEventListener('keydown', key);
    el.addEventListener('click', click, true);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', reset);
      window.removeEventListener('keydown', key);
      el.removeEventListener('click', click, true);
    };
  }, [ref, onRange]);
}
