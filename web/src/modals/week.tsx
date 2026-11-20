/**
 * One week: its focus, a habit grid you can tick back to Day 0, quick add
 * for plans (Mon to Sun chips), the plans day by day with Remove (and Undo),
 * and notes. Opens as a drawer beside the Year board on wide screens and as
 * a full sheet elsewhere. Week and pre-filled dates come from the address,
 * so dragging across days on the board opens it ready to type.
 */
import { useEffect, useRef, useState } from 'react';
import { CAT, CATS } from '@core/constants';
import { commit, S, UI } from '@core/data/state';
import { actions } from '@core/data/store';
import type { CatId, Habit, Plan } from '@core/data/types';
import { addD, clampWeek, DOW, dowI, fmt, fmtRange, pd, plural, todayS, weekDays, weekOf, WEEKS } from '@core/utils/dates';
import { doneOn, isActive, journalOn, plansOn, targetOn, valueOn } from '@core/utils/logic';
import { habitColor, logMessage, weekProgress, whenLabel } from '@core/utils/progress';
import { colorVars } from '@web/components/habit-card';
import { toast } from '@web/components/toast';
import Feather from '@web/lib/icons';
import { router, useLocalSearchParams } from '@web/lib/router';
import { C } from '@web/lib/theme';
import { useStore } from '@web/lib/use-store';
import { Btn, Chip, Chips, Field, IconBtn, ModalScreen, T } from '@web/ui';

/** Tick a day in the grid: check habits toggle; minute habits fill the day's target or clear it. */
function toggleDay(h: Habit, d: string) {
  const before = valueOn(h, d);
  const after = doneOn(h, d) ? 0 : targetOn(h, d);
  actions.setValue(h, d, after);
  toast({ message: logMessage(h, d, before, after, todayS()), undo: () => actions.setValue(h, d, before) });
}

function HabitGrid({ days }: { days: string[] }) {
  const t = todayS();
  const hs = S.meta.habits.filter((h) => days.some((d) => isActive(h, d)));
  if (!hs.length) return <p className="hc-line">No habits are scheduled this week.</p>;
  return (
    <div className="wgrid" role="grid" aria-label="Habits this week">
      <div className="wgrid-row head" role="row">
        <span role="columnheader" className="wgrid-name">
          Habits
        </span>
        {days.map((d, i) => (
          <span key={d} role="columnheader" className={d === t ? 'wgrid-day today' : 'wgrid-day'} aria-label={fmt(d, { wd: true })}>
            {DOW[i][0]}
          </span>
        ))}
        <span role="columnheader" className="wgrid-count">
          <span className="sr-only">Done</span>
        </span>
      </div>
      {hs.map((h) => {
        const p = weekProgress(h, t < days[6] ? t : days[6], weekOf(days[0]));
        return (
          <div key={h.id} className="wgrid-row" role="row" style={colorVars(h)}>
            <span role="rowheader" className="wgrid-name" title={h.name}>
              <span className="dot" style={{ background: habitColor(h).fill }} />
              <span className="nm">{h.name}</span>
            </span>
            {days.map((d) => {
              const active = isActive(h, d);
              const done = active && doneOn(h, d);
              const part = active && !done && valueOn(h, d) > 0;
              const off = !active || d > t;
              const auto = h.auto === 'journal';
              const state = !active ? 'off' : done ? 'done' : part ? 'partial' : d > t ? 'future' : 'empty';
              return (
                <span key={d} role="gridcell" className="wgrid-cell">
                  <button
                    type="button"
                    className={`wcell s-${state}${d === t ? ' today' : ''}`}
                    disabled={off || auto}
                    aria-pressed={active ? done : undefined}
                    aria-label={`${done ? 'Unlog' : 'Log'} ${h.name} for ${fmt(d, { wd: true })}${!active ? ', not scheduled' : auto ? ', ticks itself from the log' : ''}`}
                    onClick={() => toggleDay(h, d)}
                  >
                    {done ? <Feather name="check" size={13} /> : null}
                  </button>
                </span>
              );
            })}
            <span role="gridcell" className="wgrid-count" aria-label={`${p.done} of ${p.target} done`}>
              {p.done}/{p.target}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Quick add: title, Mon to Sun chips (any days; the plan runs from the first to the last), category. */
function QuickAdd({ w, days, from, to, focusTitle }: { w: number; days: string[]; from?: string; to?: string; focusTitle: boolean }) {
  const t = todayS();
  const [title, setTitle] = useState('');
  const [range, setRange] = useState<{ start: string; end: string } | null>(from ? { start: from, end: to && to >= from ? to : from } : null);
  const [cat, setCat] = useState<CatId>('work');
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setRange(from ? { start: from, end: to && to >= from ? to : from } : null);
    if (focusTitle) requestAnimationFrame(() => document.getElementById(`quick-title-${w}`)?.focus());
  }, [w, from, to, focusTitle]);

  const on = (d: string) => !!range && d >= range.start && d <= range.end;
  const toggle = (d: string) => {
    if (!range) return setRange({ start: d, end: d });
    if (range.start === d && range.end === d) return setRange(null);
    if (d < range.start) return setRange({ start: d, end: range.end });
    if (d > range.end) return setRange({ start: range.start, end: d });
    // Inside the range: trim it to end here (or start here, from the first day).
    return setRange(d === range.start ? { start: addD(d, 1), end: range.end } : { start: range.start, end: d === range.end ? addD(d, -1) : d });
  };
  const fallback = days.includes(t) ? t : days[0];
  const when = range ? whenLabel(range.start, range.end) : `${fmt(fallback, { wd: true })} (pick days to change)`;
  const add = () => {
    const name = title.trim();
    if (!name) return;
    const r = range ?? { start: fallback, end: fallback };
    actions.addPlan(name, r.start, r.end, cat);
    const added = S.meta.plans[S.meta.plans.length - 1];
    toast({ message: `Added "${name}", ${whenLabel(r.start, r.end)}.`, undo: () => added && actions.deletePlan(added.id) });
    setTitle('');
    setRange(null);
    input.current?.focus();
  };
  return (
    <form
      className="quick"
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
    >
      <label className="quick-label" htmlFor={`quick-title-${w}`}>
        Add a plan
      </label>
      <input
        id={`quick-title-${w}`}
        ref={input}
        className="field"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Client call, mini-retreat day"
        autoComplete="off"
      />
      <div className="quick-when">
        When: <strong>{when}</strong>
      </div>
      <div className="daychips" role="group" aria-label="Days">
        {days.map((d, i) => (
          <button key={d} type="button" className={on(d) ? 'daychip on' : 'daychip'} aria-pressed={on(d)} aria-label={`${on(d) ? 'Remove' : 'Add'} ${fmt(d, { wd: true })}`} onClick={() => toggle(d)}>
            {DOW[i]}
          </button>
        ))}
      </div>
      <Chips>
        {CATS.map((c) => (
          <Chip key={c.id} label={c.name} dot={c.color} on={cat === c.id} onPress={() => setCat(c.id)} />
        ))}
      </Chips>
      <button type="submit" className="btn primary" disabled={!title.trim()}>
        Add plan
      </button>
    </form>
  );
}

function removePlan(p: Plan) {
  const gone = actions.deletePlan(p.id);
  if (gone) toast({ message: `Removed "${p.title}".`, undo: () => actions.savePlan(gone) });
}

function DayList({ days }: { days: string[] }) {
  const t = todayS();
  const posts = S.posts.filter((p) => days.includes(p.date));
  const posted = posts.filter((p) => p.status === 'Posted').length;
  return (
    <section aria-label="Days">
      <div className="wsec-head">
        <span>Days</span>
        <span>
          {plural(posts.length, 'post')}, {posted} posted
        </span>
      </div>
      {days.map((d) => {
        const ps = plansOn(d);
        const po = posts.filter((p) => p.date === d);
        const j = journalOn(d);
        const today = d === t;
        return (
          <div key={d} className="wday">
            <button
              type="button"
              className={today ? 'wday-date today' : 'wday-date'}
              disabled={d > t}
              aria-label={`Open ${fmt(d, { wd: true })} in Today`}
              onClick={() => {
                UI.day = d;
                commit();
                router.dismissTo('/');
              }}
            >
              <span className="wday-dow">{DOW[dowI(d)]}</span>
              <span className="wday-num">{pd(d).getDate()}</span>
            </button>
            <div className="wday-body">
              {ps.map((p) => (
                <div key={p.id} className="wplan">
                  <span className="dot" style={{ background: CAT[p.cat]?.color ?? C.mut }} />
                  <button type="button" className="wplan-title" onClick={() => router.push({ pathname: '/plan/[id]', params: { id: p.id } })}>
                    {p.title}
                  </button>
                  {p.end !== p.start ? <span className="wplan-range">{fmtRange(p.start, p.end)}</span> : null}
                  <button type="button" className="icon-btn small" aria-label={`Remove ${p.title}`} onClick={() => removePlan(p)}>
                    <Feather name="x" size={14} />
                  </button>
                </div>
              ))}
              {po.length ? (
                <span className="hc-line">
                  {plural(po.length, 'post')} ({po.filter((p) => p.status === 'Posted').length} posted)
                </span>
              ) : null}
              {j?.text ? <span className="hc-line clamp2">“{j.text}”</span> : null}
              {!ps.length && !po.length && !j?.text ? <span className="hc-line">Nothing planned</span> : null}
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default function WeekSheet() {
  useStore();
  const params = useLocalSearchParams<{ w: string; from?: string; to?: string; focus?: string; side?: string }>();
  const w = clampWeek(Number(params.w) || 1);
  const days = weekDays(w);
  const t = todayS();
  const info = S.meta.weeks[String(w)] || {};
  const [focus, setFocus] = useState(info.focus || '');
  const [notes, setNotes] = useState(info.notes || '');
  useEffect(() => {
    const i = S.meta.weeks[String(w)] || {};
    setFocus(i.focus || '');
    setNotes(i.notes || '');
  }, [w]);
  const go = (to: number) => router.replace({ pathname: '/week/[w]', params: { w: String(to), ...(params.side ? { side: params.side } : {}) } });

  return (
    <ModalScreen
      title={`Week ${w} · ${fmtRange(days[0], days[6])}`}
      right={
        <div className="row-gap">
          <IconBtn name="chevron-left" label="Previous week" disabled={w <= 1} onPress={() => go(w - 1)} />
          <IconBtn name="chevron-right" label="Next week" disabled={w >= WEEKS} onPress={() => go(w + 1)} />
        </div>
      }
    >
      <T w={600} s={12} c={C.mut} style={{ marginTop: -10 }}>
        {pd(days[6]).getFullYear()}
        {w === weekOf(t) ? ', this week' : ''}
      </T>
      <Field
        label="Week focus, shows on the board"
        value={focus}
        onChangeText={(v) => {
          setFocus(v);
          actions.saveWeek(w, { focus: v }, true);
        }}
        onBlur={() => commit()}
        placeholder="What is this week about?"
      />
      <HabitGrid days={days} />
      <QuickAdd w={w} days={days} from={params.from} to={params.to} focusTitle={params.focus === 'plan'} />
      <DayList days={days} />
      <Field
        label="Notes"
        value={notes}
        onChangeText={(v) => {
          setNotes(v);
          actions.saveWeek(w, { notes: v }, true);
        }}
        onBlur={() => commit()}
        placeholder="Wins, misses, reminders for this week"
        multiline
      />
      <Btn label="Share this week as an image" kind="ghost" icon="share" onPress={() => router.push({ pathname: '/share', params: { kind: 'week', w: String(w) } })} />
    </ModalScreen>
  );
}

