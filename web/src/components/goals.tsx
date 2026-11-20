/**
 * Quarter goals as a checklist (up to 5). Enter adds a goal and keeps the
 * field focused for the next; the circle ticks it off; × removes it (Undo in
 * the toast). The current quarter is outlined "Now"; past ones say "Done".
 */
import { useRef, useState } from 'react';
import { S, uid } from '@core/data/state';
import { actions } from '@core/data/store';
import type { GoalItem, GoalKey } from '@core/data/types';
import { fmt, todayS } from '@core/utils/dates';
import { goalItems, MAX_GOALS, quarterOf, quarterRange } from '@core/utils/progress';
import Feather from '@web/lib/icons';
import { toast } from './toast';

export function GoalCard({ q }: { q: 1 | 2 | 3 | 4 }) {
  const key = `q${q}` as GoalKey;
  const items = goalItems(S.meta.goals[key], key);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const t = todayS();
  const range = quarterRange(q);
  const now = quarterOf(t) === q && t >= range.start;
  const past = range.end < t;
  const done = items.filter((i) => i.done).length;
  const save = (next: GoalItem[]) => actions.saveGoalItems(q, next);

  const add = () => {
    const text = draft.trim();
    if (!text || items.length >= MAX_GOALS) return;
    save([...items, { id: uid('g'), text, done: false }]);
    setDraft('');
    requestAnimationFrame(() => input.current?.focus());
  };
  const remove = (g: GoalItem) => {
    const before = items;
    save(items.filter((x) => x.id !== g.id));
    toast({ message: `Removed "${g.text}".`, undo: () => save(before) });
  };

  return (
    <section className={`goals${now ? ' now' : ''}`} aria-labelledby={`goals-${q}`}>
      <header className="goals-head">
        <h3 id={`goals-${q}`}>
          Q{q} goals{' '}
          <span className="goals-range">
            {fmt(range.start)} – {fmt(range.end)}
          </span>
        </h3>
        {now ? <span className="goals-badge now">Now</span> : past ? <span className="goals-badge">Done</span> : null}
      </header>
      {items.length ? (
        <ul className="goal-list">
          {items.map((g) => (
            <li key={g.id} className={g.done ? 'goal done' : 'goal'}>
              <button
                type="button"
                className="goal-tick"
                role="checkbox"
                aria-checked={g.done}
                aria-label={g.text}
                onClick={() => save(items.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)))}
              >
                {g.done ? <Feather name="check" size={13} /> : null}
              </button>
              <span className="goal-text">{g.text}</span>
              <button type="button" className="icon-btn small" aria-label={`Remove ${g.text}`} onClick={() => remove(g)}>
                <Feather name="x" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {items.length < MAX_GOALS ? (
        <form
          className="goal-add"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            ref={input}
            className="field"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={items.length ? 'Add another goal' : 'Add a goal'}
            aria-label={`Add a Q${q} goal`}
            maxLength={140}
          />
          <button type="submit" className="btn" disabled={!draft.trim()}>
            Add
          </button>
        </form>
      ) : (
        <p className="hc-line">That's {MAX_GOALS} goals. Remove one to add another.</p>
      )}
      {items.length ? (
        <p className="goals-count">
          {done} of {items.length} done
        </p>
      ) : null}
    </section>
  );
}
