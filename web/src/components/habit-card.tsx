/**
 * One habit: a round tick button in the habit's colour, its streak, this
 * week as 7 segments (today larger and outlined), and "3 of 6 this week"
 * (or "30 of 240 min today" for minute habits, which opens exact entry).
 * The ··· menu has Edit, Archive and Delete.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { S } from '@core/data/state';
import type { Habit } from '@core/data/types';
import { DOW, fmt, todayS } from '@core/utils/dates';
import { doneOn, isActive, streak, targetOn, valueOn } from '@core/utils/logic';
import { habitColor, progressLine, weekStrip, type DayState } from '@core/utils/progress';
import Feather from '@web/lib/icons';
import { router } from '@web/lib/router';
import { setSpotlight } from '@web/lib/view-state';
import { UI } from '@core/data/state';
import { archiveHabit, deleteHabit, logHabit } from './habit-actions';

const STATE_WORDS: Record<DayState, string> = {
  done: 'done',
  partial: 'partly done',
  missed: 'missed',
  empty: 'not done',
  future: 'coming up',
  off: 'off',
};

export const colorVars = (h: Habit): CSSProperties => {
  const c = habitColor(h);
  return { '--hc': c.fill, '--hc-tint': c.tint, '--hc-line': c.line, '--hc-dim': c.dim } as CSSProperties;
};

/** The round tick button. Minute habits show progress as an arc until they're done. */
export function Ring({ h, d, size = 44 }: { h: Habit; d: string; size?: number }) {
  const [pop, setPop] = useState(false);
  const val = valueOn(h, d);
  const tgt = targetOn(h, d);
  const done = doneOn(h, d);
  const future = d > todayS();
  const auto = h.auto === 'journal';
  const when = d === todayS() ? 'today' : fmt(d, { wd: true });
  const label = auto
    ? `${h.name}: ${done ? 'done' : 'not done'} ${when}. Write the log to tick it.`
    : h.type === 'minutes'
      ? `Add ${h.step || 1} minutes of ${h.name} for ${when}, ${val} of ${tgt} so far`
      : `${done ? 'Unlog' : 'Log'} ${h.name} for ${when}`;
  const r = size / 2 - 3;
  const circ = 2 * Math.PI * r;
  const frac = Math.min(1, val / tgt);
  return (
    <button
      type="button"
      className={`ring${done ? ' on' : ''}${pop ? ' pop' : ''}`}
      style={{ width: size, height: size }}
      onAnimationEnd={() => setPop(false)}
      disabled={future}
      aria-label={label}
      aria-pressed={h.type === 'check' && !auto ? done : undefined}
      onClick={() => {
        if (!logHabit(h, d)) return;
        // Restart the pop even if the last one is still running.
        setPop(false);
        requestAnimationFrame(() => setPop(true));
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} />
        {!done && frac > 0 ? (
          <circle className="ring-arc" cx={size / 2} cy={size / 2} r={r} strokeDasharray={`${circ * frac} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null}
      </svg>
      <span className="ring-icon">{done ? <Feather name="check" size={Math.round(size * 0.45)} /> : auto ? <Feather name="edit-3" size={Math.round(size * 0.36)} /> : h.type === 'minutes' ? <span className="ring-plus">+{h.step || 1}</span> : null}</span>
    </button>
  );
}

export function WeekStrip({ h, d }: { h: Habit; d: string }) {
  const days = weekStrip(h, d);
  const summary = days.map((x, i) => `${DOW[i]} ${STATE_WORDS[x.state]}`).join(', ');
  return (
    <div className="strip" role="img" aria-label={`This week: ${summary}`}>
      {days.map((x) => (
        <span key={x.date} className={`cap s-${x.state}${x.today ? ' today' : ''}`} title={`${fmt(x.date, { wd: true })}: ${STATE_WORDS[x.state]}${h.type === 'minutes' && x.state !== 'off' ? `, ${x.value} of ${x.target} min` : ''}`} />
      ))}
    </div>
  );
}

/** Eye: show only this habit on the Year board. */
export function SpotlightButton({ h }: { h: Habit }) {
  const on = UI.spotlight === h.id;
  return (
    <button
      type="button"
      className="icon-btn"
      aria-pressed={on}
      aria-label={`Spotlight ${h.name} on the board`}
      title={on ? 'Showing on the board. Click to show all habits.' : 'Show only this habit on the board'}
      onClick={() => {
        setSpotlight(on ? '' : h.id);
        if (!on && !location.pathname.startsWith('/year')) router.push('/year');
      }}
    >
      <Feather name="eye" size={17} />
    </button>
  );
}

function Menu({ h }: { h: Habit }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!list.current?.contains(e.target as Node) && e.target !== btn.current) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const items = [...(list.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        btn.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
      } else if (e.key === 'Tab') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="menu-wrap">
      <button ref={btn} type="button" className="icon-btn" aria-label={`More for ${h.name}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Feather name="more-horizontal" size={18} />
      </button>
      {open ? (
        <div ref={list} className="menu" role="menu" aria-label={h.name}>
          <button type="button" role="menuitem" onClick={pick(() => router.push({ pathname: '/habit/[id]', params: { id: h.id } }))}>
            <Feather name="edit-2" size={15} /> Edit
          </button>
          <button type="button" role="menuitem" onClick={pick(() => archiveHabit(h))}>
            <Feather name="archive" size={15} /> Archive
          </button>
          <button type="button" role="menuitem" className="danger" onClick={pick(() => void deleteHabit(h))}>
            <Feather name="trash-2" size={15} /> Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function HabitCard({ h, d }: { h: Habit; d: string }) {
  const t = todayS();
  const done = doneOn(h, d);
  const st = streak(h, d <= t ? d : t);
  const line = progressLine(h, d);
  return (
    <article className={`hcard${done ? ' done' : ''}`} style={colorVars(h)} aria-label={h.name}>
      <Ring h={h} d={d} />
      <div className="hc-main">
        <div className="hc-top">
          <span className="hc-name">{h.name}</span>
          {st.n > 0 ? (
            <span className="hc-streak" title={`${st.n}-${st.unit} streak`} aria-label={`${st.n}-${st.unit} streak`}>
              <Feather name="flame" size={13} />
              {st.n}
              {st.unit === 'week' ? 'w' : ''}
            </span>
          ) : null}
        </div>
        <WeekStrip h={h} d={d} />
        {h.type === 'minutes' && isActive(h, d) && d <= t ? (
          <button type="button" className="hc-line link" onClick={() => router.push({ pathname: '/minutes/[hid]', params: { hid: h.id, d } })} aria-label={`${line}. Enter exact minutes`}>
            {line}
          </button>
        ) : (
          <span className="hc-line">{h.auto === 'journal' && !done && d === t ? "Ticks itself when you write tonight's log" : line}</span>
        )}
      </div>
      <div className="hc-actions">
        <SpotlightButton h={h} />
        <Menu h={h} />
      </div>
    </article>
  );
}

/** The habits active on day `d`, as cards. */
export function HabitCards({ d, compact }: { d: string; compact?: boolean }) {
  const list = S.meta.habits.filter((h) => isActive(h, d));
  return (
    <div className={compact ? 'hcards compact' : 'hcards'}>
      {list.map((h) => (
        <HabitCard key={h.id} h={h} d={d} />
      ))}
    </div>
  );
}
