/**
 * Share images: Week, Month and Year cards, each 360 × 450 on screen and saved
 * at 1080 × 1350 (the portrait size Instagram uses). Options: hide plan
 * titles, include habit stats, and colour days by habits or by plans.
 * Plans in hidden categories (the board's Show filter) stay out.
 */
import type { CSSProperties, ReactNode } from 'react';
import { CAT, CATS } from '@core/constants';
import { S, UI } from '@core/data/state';
import type { Plan } from '@core/data/types';
import { clampWeek, DOW, fmt, fmtRange, MONTHS, MONTHS_LONG, pd, plural, todayS, weekDays, weekOf, WEEKS, YEAR_END, YEAR_START } from '@core/utils/dates';
import { barColor, chapterAt, doneOn, isActive, isPerfect, plansOn, yearStats } from '@core/utils/logic';
import { doneDays, habitColor, monthGrid, perfectWeeks, scheduledDays, weekProgress } from '@core/utils/progress';
import { C } from '@web/lib/theme';

export type ShareOptions = { hidePlans: boolean; stats: boolean; by: 'habits' | 'plans' };

const F = 'Montserrat, system-ui, sans-serif';
const card: CSSProperties = { width: 360, height: 450, background: C.bg, padding: 22, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: F, color: C.tx, overflow: 'hidden' };
const small = (size: number, color: string = C.mut, weight = 600): CSSProperties => ({ fontSize: size, color, fontWeight: weight, lineHeight: 1.3 });

const visiblePlans = (list: Plan[]) => list.filter((p) => !UI.hideCats.has(p.cat));
/** Text colour that reads on a day's fill: dark on light fills, light on dark ones. */
function ink(bg: string) {
  const n = parseInt(bg.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.45 ? C.bg : C.tx;
}
/** The colour of a day: habit progress (greys to white), or the category of its plan. */
function dayColor(d: string, o: ShareOptions, t: string) {
  if (d < YEAR_START || d > YEAR_END) return '#100F0E';
  if (o.by === 'plans') {
    const ps = visiblePlans(plansOn(d));
    return ps.length ? CAT[ps[ps.length - 1].cat].color : d > t ? '#141312' : '#1B1918';
  }
  return barColor(d, t);
}

function Header({ over, title, under }: { over: string; title: string; under: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={small(10)}>{over}</span>
      <span style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      <span style={small(10, C.mut, 500)}>{under}</span>
    </div>
  );
}

/** Habit stats as small chips in each habit's colour. */
function StatChips({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {items.map((x, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 999, background: '#1A1817', ...small(8.5, C.tx2) }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: x.color }} />
          {x.label}
        </span>
      ))}
    </div>
  );
}

function Legend({ by }: { by: ShareOptions['by'] }) {
  if (by === 'plans')
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CATS.filter((c) => !UI.hideCats.has(c.id)).map((c) => (
          <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...small(8) }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: c.color }} />
            {c.name}
          </span>
        ))}
      </div>
    );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, ...small(8) }}>
      Fewer habits
      {['#24211F', '#4A4642', '#827D78', '#B9B4AE', '#ECE8E2'].map((c) => (
        <span key={c} style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
      ))}
      All habits
    </span>
  );
}

function Footer({ children }: { children?: ReactNode }) {
  return (
    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      {children ?? <span />}
      <span style={small(9, C.mut2)}>Year Wall</span>
    </div>
  );
}

/* ---------- week: one row per day ---------- */

export function WeekShareCard({ w, o }: { w: number; o: ShareOptions }) {
  const t = todayS();
  const days = weekDays(w);
  const focus = S.meta.weeks[String(w)]?.focus;
  const ch = chapterAt(days[3]);
  const hs = S.meta.habits.filter((h) => days.some((d) => isActive(h, d)));
  const perfect = isPerfect(w, t);
  return (
    <div style={card}>
      <Header over={`Week ${w} of ${WEEKS}${ch ? ` · Chapter ${ch.n}: ${ch.name}` : ''}`} title={focus || fmtRange(days[0], days[6])} under={`${fmtRange(days[0], days[6])}, ${pd(days[6]).getFullYear()}${perfect ? ' · Perfect week' : ''}`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {days.map((d, i) => {
          const ps = visiblePlans(plansOn(d));
          return (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 8, background: C.s1, border: `1px solid ${d === t ? C.lit : C.off}` }}>
              <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: dayColor(d, o, t) }} />
              <span style={{ width: 40, ...small(9, C.tx, 700) }}>
                {DOW[i]} {pd(d).getDate()}
              </span>
              <span style={{ display: 'flex', gap: 3 }}>
                {hs.map((h) => (
                  <span key={h.id} style={{ width: 7, height: 7, borderRadius: 4, background: !isActive(h, d) ? 'transparent' : d <= t && doneOn(h, d) ? habitColor(h).fill : '#2A2725', border: isActive(h, d) ? 'none' : '1px dashed #2A2725', boxSizing: 'border-box' }} />
                ))}
              </span>
              <span style={{ flex: 1, minWidth: 0, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...small(8.5, C.tx2, 500) }}>
                {ps.length ? (o.hidePlans ? plural(ps.length, 'plan') : ps.map((p) => p.title).join(' · ')) : ''}
              </span>
            </div>
          );
        })}
      </div>
      {o.stats ? (
        <StatChips
          items={hs.map((h) => {
            const p = weekProgress(h, t < days[6] ? t : days[6], w);
            return { color: habitColor(h).fill, label: `${h.name} ${p.done}/${p.target}` };
          })}
        />
      ) : null}
      <Footer>
        <Legend by={o.by} />
      </Footer>
    </div>
  );
}

/* ---------- month: a calendar ---------- */

export function MonthShareCard({ ym, o }: { ym: string; o: ShareOptions }) {
  const t = todayS();
  const [y, m] = ym.split('-').map(Number);
  const rows = monthGrid(ym);
  const first = `${ym}-01`;
  const last = rows.flat().filter(Boolean).at(-1)!;
  const plans = visiblePlans(S.meta.plans.filter((p) => p.start <= last && (p.end || p.start) >= first)).sort((a, b) => (a.start < b.start ? -1 : 1));
  const hs = S.meta.habits.filter((h) => scheduledDays(h, first, last, last) > 0);
  const ch = chapterAt(first < YEAR_START ? YEAR_START : first);
  return (
    <div style={card}>
      <Header over={ch ? `Chapter ${ch.n}: ${ch.name}` : 'Year Wall'} title={`${MONTHS_LONG[m - 1]} ${y}`} under={plural(plans.length, 'plan')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {DOW.map((x) => (
          <span key={x} style={{ textAlign: 'center', ...small(8, C.mut2) }}>
            {x[0]}
          </span>
        ))}
        {rows.flat().map((d, i) =>
          d ? (
            <span key={d} style={{ position: 'relative', height: 30, borderRadius: 6, background: dayColor(d, o, t), border: d === t ? `1.5px solid ${C.lit}` : 'none', boxSizing: 'border-box' }}>
              <span style={{ position: 'absolute', top: 3, left: 5, ...small(8, ink(dayColor(d, o, t))) }}>{pd(d).getDate()}</span>
            </span>
          ) : (
            <span key={`x${i}`} />
          ),
        )}
      </div>
      {!o.hidePlans && plans.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {plans.slice(0, o.stats ? 3 : 5).map((p) => (
            <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', ...small(9, C.tx2, 500) }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: CAT[p.cat].color, flexShrink: 0 }} />
              <span style={{ ...small(9, C.mut) }}>{fmtRange(p.start, p.end)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
            </span>
          ))}
        </div>
      ) : null}
      {o.stats ? <StatChips items={hs.map((h) => ({ color: habitColor(h).fill, label: `${h.name} ${plural(doneDays(h, first, last, t), 'day')}` }))} /> : null}
      <Footer>
        <Legend by={o.by} />
      </Footer>
    </div>
  );
}

/* ---------- year: a contribution grid, one column per week ---------- */

export function YearShareCard({ o }: { o: ShareOptions }) {
  const t = todayS();
  const cw = clampWeek(weekOf(t));
  const st = yearStats(t);
  const pw = perfectWeeks(t);
  const cols = Array.from({ length: WEEKS }, (_, i) => weekDays(i + 1));
  const ch = chapterAt(t);
  // Month labels over the first week of each month.
  const labels = cols.map((days, i) => {
    const m = pd(days[0]).getMonth();
    return i === 0 || pd(cols[i - 1][0]).getMonth() !== m ? MONTHS[m] : '';
  });
  const milestones = visiblePlans(S.meta.plans.filter((p) => p.milestone)).sort((a, b) => (a.start < b.start ? -1 : 1));
  return (
    <div style={card}>
      <Header over={ch ? `Chapter ${ch.n}: ${ch.name}` : 'The chapter year'} title="Year Wall" under={`Week ${cw} of ${WEEKS} · ${plural(pw.count, 'perfect week')} · ${plural(st.active, 'active day')}`} />
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS}, 5px)`, columnGap: 1, height: 10 }}>
          {labels.map((l, i) => (
            <span key={i} style={{ ...small(6.5, C.mut2), whiteSpace: 'nowrap', overflow: 'visible' }}>
              {l}
            </span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS}, 5px)`, gridTemplateRows: 'repeat(7, 5px)', gridAutoFlow: 'column', gap: 1 }}>
          {cols.flat().map((d) => (
            <span key={d} style={{ width: 5, height: 5, borderRadius: 1, background: dayColor(d, o, t), outline: d === t ? `1px solid ${C.lit}` : 'none' }} />
          ))}
        </div>
      </div>
      {!o.hidePlans && milestones.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={small(9)}>Milestones</span>
          {milestones.slice(0, 4).map((p) => (
            <span key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', ...small(9, C.tx2, 500) }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: CAT[p.cat].color, flexShrink: 0 }} />
              <span style={{ ...small(9, C.mut) }}>{fmt(p.start)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
              {p.outcome === 'done' ? <span style={small(9, C.ok)}>✓</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      {o.stats ? (
        <StatChips
          items={[
            { color: C.ok, label: `${plural(pw.count, 'perfect week')}${pw.bestRun > 1 ? `, best run ${pw.bestRun}` : ''}` },
            { color: C.lit, label: `Best streak ${plural(st.best, 'day')}` },
            ...S.meta.habits.map((h) => ({ color: habitColor(h).fill, label: `${h.name} ${plural(doneDays(h, YEAR_START, YEAR_END, t), 'day')}` })),
          ]}
        />
      ) : null}
      <Footer>
        <Legend by={o.by} />
      </Footer>
    </div>
  );
}
