/**
 * A coach-mark tour of the real screens: each step dims the page except one
 * element and explains it in a sentence or two. Step count, dots, Back and
 * Next; Esc or × ends it. Replaces the old intro and can be replayed from
 * Settings or "How it works". Finishing or skipping marks it done (synced).
 */
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { S } from '@core/data/state';
import { actions } from '@core/data/store';
import { clampWeek, todayS, weekOf } from '@core/utils/dates';
import Feather from '@web/lib/icons';
import { reducedMotion } from '@web/lib/media';
import { router, useLocation } from '@web/lib/router';

type Step = { route: '/' | '/year'; target: () => string[]; title: string; body: () => string };

const fine = () => matchMedia('(pointer: fine)').matches;
const STEPS: Step[] = [
  {
    route: '/',
    target: () => ['[data-tour=cards]'],
    title: 'Log from Today',
    body: () => `${fine() ? 'Click' : 'Tap'} a ring to log a habit. Checks switch on and off; minute habits add one block per ${fine() ? 'click' : 'tap'}. The toast that follows has Undo.`,
  },
  {
    route: '/',
    target: () => ['[data-tour=strip]'],
    title: 'Streaks and your week',
    body: () => 'The flame is your streak. The seven bars are this week, with today outlined. Paused days never break a streak.',
  },
  {
    route: '/year',
    target: () => ['[data-tour=board]'],
    title: 'Your year on one wall',
    body: () => 'Fifty-two weeks, one bar per day. Bars light up as you finish your habits, and a coloured cap marks a plan.',
  },
  {
    route: '/year',
    target: () => [`#wk-${clampWeek(weekOf(todayS()))}`],
    title: 'Open a week',
    body: () => `${fine() ? 'Click' : 'Tap'} a week to set its focus, tick past days, add plans and write notes.`,
  },
  {
    route: '/year',
    target: () => ['[data-tour=board]'],
    title: 'Plan in one move',
    body: () => (fine() ? 'Drag across days on the board to plan them. The week opens with the dates filled in, ready for a title.' : 'Open a week and pick its days with the Mon to Sun chips to plan them.'),
  },
  {
    route: '/year',
    target: () => ['.sidebar [data-tour=spot]', '[data-tour=board]'],
    title: 'Spotlight one habit',
    body: () => 'The eye on a habit shows only that habit on the board: its done days in its colour, and how many days each week hit.',
  },
  {
    route: '/year',
    target: () => ['#tour-perfect'],
    title: 'Perfect weeks',
    body: () => 'A week where every habit hits its target turns green and counts here, along with your best run.',
  },
  {
    route: '/year',
    target: () => ['[data-tour=goals]'],
    title: 'Quarter goals',
    body: () => 'Up to five goals for each quarter. Tick them off as you go.',
  },
  {
    route: '/year',
    target: () => ['#tour-share'],
    title: 'Share your progress',
    body: () => 'Make an image of a week, a month or the whole year. You can come back to this tour from Settings or "How it works".',
  },
];

let step: number | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function startTour() {
  step = 0;
  notify();
}

function finish() {
  step = null;
  notify();
  if (!S.meta.settings.tourDone) actions.saveSettings({ tourDone: true });
}

const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).getBoundingClientRect().width > 0;

export function TourHost() {
  const i = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => step,
  );
  const loc = useLocation();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(200);
  const s = i === null ? null : STEPS[i];
  const go = (d: number) => {
    const n = (step ?? 0) + d;
    if (n < 0) return;
    if (n >= STEPS.length) return finish();
    step = n;
    notify();
  };

  // Go to the step's screen (closing any dialog), find its element and keep measuring it.
  useEffect(() => {
    if (!s) return;
    if (loc.split('?')[0] !== s.route) {
      router.navigate(s.route);
      return;
    }
    let el: HTMLElement | null = null;
    let tries = 0;
    let raf = 0;
    const measure = () => setRect(el ? el.getBoundingClientRect() : null);
    const find = () => {
      el = s
        .target()
        .map((q) => document.querySelector(q))
        .find(visible) as HTMLElement | null;
      if (!el && tries++ < 20) {
        raf = requestAnimationFrame(find);
        return;
      }
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
        setTimeout(measure, reducedMotion() ? 0 : 350);
      }
      measure();
    };
    find();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [s, loc]);

  // Keyboard: Esc ends, arrows move, Tab stays in the card. Focus starts on the title.
  useEffect(() => {
    if (i === null) return;
    card.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish();
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Tab' && card.current) {
        const items = [...card.current.querySelectorAll<HTMLElement>('button, h2')];
        const k = items.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        items[(k + (e.shiftKey ? items.length - 1 : 1)) % items.length]?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [i]);

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  }, [i, rect]);

  if (i === null || !s) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(360, vw - 32);
  const pad = 8;
  let top = vh / 2 - cardH / 2;
  let left = vw / 2 - w / 2;
  if (rect && vw >= 720) {
    const below = rect.bottom + pad + 12;
    const above = rect.top - pad - 12 - cardH;
    top = below + cardH < vh - 16 ? below : above > 16 ? above : Math.max(16, vh - cardH - 16);
    left = Math.min(Math.max(16, rect.left + rect.width / 2 - w / 2), vw - w - 16);
  } else if (rect) {
    // Phones: the card sits at the top or bottom, away from the highlighted part.
    top = rect.top + rect.height / 2 > vh / 2 ? 16 : vh - cardH - 80;
  }

  return (
    <div className="tour" role="presentation">
      {rect ? (
        <div
          className="tour-hole"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div ref={card} className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" style={{ top, left, width: w }}>
        <div className="tour-top">
          <span className="tour-count">
            {i + 1} of {STEPS.length}
          </span>
          <button type="button" className="icon-btn small" aria-label="End the tour" onClick={finish}>
            <Feather name="x" size={14} />
          </button>
        </div>
        <h2 id="tour-title" tabIndex={-1}>
          {s.title}
        </h2>
        <p id="tour-body">{s.body()}</p>
        <div className="tour-foot">
          <span className="tour-dots" aria-hidden="true">
            {STEPS.map((_, k) => (
              <span key={k} className={k === i ? 'on' : ''} />
            ))}
          </span>
          <span className="row-gap">
            {i > 0 ? (
              <button type="button" className="btn" onClick={() => go(-1)}>
                Back
              </button>
            ) : null}
            <button type="button" className="btn primary" onClick={() => go(1)}>
              {i === STEPS.length - 1 ? 'Done' : 'Next'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
