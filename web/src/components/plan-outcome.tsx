/**
 * "Did it happen?" for a plan whose dates have passed. Yes or No records the
 * outcome (it syncs); afterwards it shows ✓ or ✗ with an inline Undo.
 * Plans that haven't ended show nothing.
 */
import { useRef } from 'react';
import { S } from '@core/data/state';
import { actions } from '@core/data/store';
import type { Plan } from '@core/data/types';
import { addD, fmt, todayS } from '@core/utils/dates';
import { needsOutcome } from '@core/utils/progress';
import { CAT } from '@core/constants';
import Feather from '@web/lib/icons';

export function PlanOutcome({ p }: { p: Plan }) {
  // After answering, focus the inline Undo; after Undo, focus Yes. The wrapper stays put while its
  // contents change, so find it before saving.
  const answer = (e: { currentTarget: HTMLElement }, v: 'done' | 'missed' | null) => {
    const row = e.currentTarget.closest<HTMLElement>('[data-outcome]');
    actions.setPlanOutcome(p.id, v);
    requestAnimationFrame(() => row?.querySelector<HTMLElement>(v ? '.outcome-undo' : '.outcome-btn')?.focus());
  };
  return (
    <span data-outcome={p.id} className="outcome-wrap">
      <OutcomeInner p={p} answer={answer} />
    </span>
  );
}

function OutcomeInner({ p, answer }: { p: Plan; answer: (e: { currentTarget: HTMLElement }, v: 'done' | 'missed' | null) => void }) {
  if (p.outcome)
    return (
      <span className={`outcome ${p.outcome}`}>
        <Feather name={p.outcome === 'done' ? 'check' : 'x'} size={13} />
        {p.outcome === 'done' ? 'Happened' : "Didn't happen"}
        <button type="button" className="outcome-undo" aria-label={`Undo: ${p.title} ${p.outcome === 'done' ? 'happened' : "didn't happen"}`} onClick={(e) => answer(e, null)}>
          Undo
        </button>
      </span>
    );
  if (!needsOutcome(p)) return null;
  return (
    <span className="outcome ask" role="group" aria-label={`Did ${p.title} happen?`}>
      <span aria-hidden="true">Did it happen?</span>
      <button type="button" className="outcome-btn" aria-label={`Yes, ${p.title} happened`} onClick={(e) => answer(e, 'done')}>
        Yes
      </button>
      <button type="button" className="outcome-btn" aria-label={`No, ${p.title} didn't happen`} onClick={(e) => answer(e, 'missed')}>
        No
      </button>
    </span>
  );
}

/** Plans that ended in the last two weeks and still need an answer (most recent first). */
export const plansToAnswer = (ref = todayS()) =>
  S.meta.plans
    .filter((p) => needsOutcome(p, ref) && (p.end || p.start) >= addD(ref, -14))
    .sort((a, b) => ((a.end || a.start) < (b.end || b.start) ? 1 : -1));

/**
 * A short list on Today: the recent plans that still need a Yes or No.
 * Plans answered here stay in the list (with Undo) until you leave the page.
 */
export function PlansToAnswer() {
  const seen = useRef<string[]>([]);
  plansToAnswer()
    .slice(0, 4)
    .forEach((p) => {
      if (!seen.current.includes(p.id)) seen.current.push(p.id);
    });
  const list = seen.current.map((id) => S.meta.plans.find((p) => p.id === id)).filter((p): p is Plan => !!p);
  if (!list.length) return null;
  return (
    <section className="answer" aria-labelledby="answer-title">
      <h3 id="answer-title" className="answer-title">
        Did these happen?
      </h3>
      {list.map((p) => (
        <div key={p.id} className="answer-row">
          <span className="dot" style={{ background: CAT[p.cat]?.color }} />
          <span className="answer-name">
            {p.title}
            <span className="answer-when"> · {fmt(p.end || p.start, { wd: true })}</span>
          </span>
          <PlanOutcome p={p} />
        </div>
      ))}
    </section>
  );
}
