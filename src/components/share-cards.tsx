/**
 * Share images: Week, Month and Year cards, each 360 × 450 on screen and saved
 * at 1080 × 1350 (the portrait size Instagram uses). Options: hide plan
 * titles, include habit stats, and colour days by habits or by plans.
 * Plans in hidden categories (the board's Show filter) stay out.
 * Same content as the web app's cards (web/src/share-cards.tsx).
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { T } from '@/components/ui';
import { CAT, CATS } from '@/constants';
import { S, UI } from '@/data/state';
import type { Plan } from '@/data/types';
import { C } from '@/theme';
import type { Weight } from '@/theme';
import { clampWeek, DOW, fmt, fmtRange, MONTHS, MONTHS_LONG, pd, plural, todayS, weekDays, weekOf, WEEKS, YEAR_END, YEAR_START } from '@/utils/dates';
import { barColor, chapterAt, doneOn, isActive, isPerfect, plansOn, yearStats } from '@/utils/logic';
import { doneDays, habitColor, monthGrid, perfectWeeks, scheduledDays, weekProgress } from '@/utils/progress';

export type ShareOptions = { hidePlans: boolean; stats: boolean; by: 'habits' | 'plans' };

const card = { width: 360, height: 450, backgroundColor: C.bg, padding: 22, gap: 12, overflow: 'hidden' as const };
const Small = ({ s, c = C.mut, w = 600, children, lines }: { s: number; c?: string; w?: Weight; children: ReactNode; lines?: number }) => (
  <T s={s} c={c} w={w} numberOfLines={lines} style={{ lineHeight: Math.round(s * 1.3) }}>
    {children}
  </T>
);

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
    <View style={{ gap: 2 }}>
      <Small s={10}>{over}</Small>
      <T w={700} s={21} numberOfLines={1} style={{ lineHeight: 26 }}>
        {title}
      </T>
      <Small s={10} w={500}>
        {under}
      </Small>
    </View>
  );
}

/** Habit stats as small chips in each habit's colour. */
function StatChips({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {items.map((x, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: '#1A1817' }}>
          <View style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: x.color }} />
          <Small s={8.5} c={C.tx2}>
            {x.label}
          </Small>
        </View>
      ))}
    </View>
  );
}

function Legend({ by }: { by: ShareOptions['by'] }) {
  if (by === 'plans')
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, flexShrink: 1 }}>
        {CATS.filter((c) => !UI.hideCats.has(c.id)).map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: c.color }} />
            <Small s={8}>{c.name}</Small>
          </View>
        ))}
      </View>
    );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Small s={8}>Fewer habits</Small>
      {['#24211F', '#4A4642', '#827D78', '#B9B4AE', '#ECE8E2'].map((c) => (
        <View key={c} style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c }} />
      ))}
      <Small s={8}>All habits</Small>
    </View>
  );
}

function Footer({ children }: { children?: ReactNode }) {
  return (
    <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      {children ?? <View />}
      <Small s={9} c={C.mut2}>
        Year Wall
      </Small>
    </View>
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
    <View style={card}>
      <Header over={`Week ${w} of ${WEEKS}${ch ? ` · Chapter ${ch.n}: ${ch.name}` : ''}`} title={focus || fmtRange(days[0], days[6])} under={`${fmtRange(days[0], days[6])}, ${pd(days[6]).getFullYear()}${perfect ? ' · Perfect week' : ''}`} />
      <View style={{ gap: 5 }}>
        {days.map((d, i) => {
          const ps = visiblePlans(plansOn(d));
          return (
            <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: C.s1, borderWidth: 1, borderColor: d === t ? C.lit : C.off }}>
              <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: dayColor(d, o, t) }} />
              <View style={{ width: 40 }}>
                <Small s={9} c={C.tx} w={700}>
                  {DOW[i]} {pd(d).getDate()}
                </Small>
              </View>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {hs.map((h) => {
                  const a = isActive(h, d);
                  return (
                    <View
                      key={h.id}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: !a ? 'transparent' : d <= t && doneOn(h, d) ? habitColor(h).fill : '#2A2725',
                        ...(a ? {} : { borderWidth: 1, borderStyle: 'dashed' as const, borderColor: '#2A2725' }),
                      }}
                    />
                  );
                })}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T s={8.5} w={500} c={C.tx2} numberOfLines={1} style={{ textAlign: 'right', lineHeight: 11 }}>
                  {ps.length ? (o.hidePlans ? plural(ps.length, 'plan') : ps.map((p) => p.title).join(' · ')) : ''}
                </T>
              </View>
            </View>
          );
        })}
      </View>
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
    </View>
  );
}

/* ---------- month: a calendar ---------- */

export function MonthShareCard({ ym, o }: { ym: string; o: ShareOptions }) {
  const t = todayS();
  const [y, m] = ym.split('-').map(Number);
  const rows = monthGrid(ym);
  const first = `${ym}-01`;
  const flat = rows.flat().filter((d): d is string => !!d);
  const last = flat[flat.length - 1];
  const plans = visiblePlans(S.meta.plans.filter((p) => p.start <= last && (p.end || p.start) >= first)).sort((a, b) => (a.start < b.start ? -1 : 1));
  const hs = S.meta.habits.filter((h) => scheduledDays(h, first, last, last) > 0);
  const ch = chapterAt(first < YEAR_START ? YEAR_START : first);
  return (
    <View style={card}>
      <Header over={ch ? `Chapter ${ch.n}: ${ch.name}` : 'Year Wall'} title={`${MONTHS_LONG[m - 1]} ${y}`} under={plural(plans.length, 'plan')} />
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {DOW.map((x) => (
            <View key={x} style={{ flex: 1, alignItems: 'center' }}>
              <Small s={8} c={C.mut2}>
                {x[0]}
              </Small>
            </View>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: 4 }}>
            {row.map((d, i) =>
              d ? (
                <View key={d} style={{ flex: 1, height: 30, borderRadius: 6, backgroundColor: dayColor(d, o, t), borderWidth: d === t ? 1.5 : 0, borderColor: C.lit, paddingTop: 2, paddingLeft: 5 }}>
                  <Small s={8} c={ink(dayColor(d, o, t))}>
                    {pd(d).getDate()}
                  </Small>
                </View>
              ) : (
                <View key={`x${i}`} style={{ flex: 1 }} />
              ),
            )}
          </View>
        ))}
      </View>
      {!o.hidePlans && plans.length ? (
        <View style={{ gap: 3 }}>
          {plans.slice(0, o.stats ? 3 : 5).map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: CAT[p.cat].color }} />
              <Small s={9}>{fmtRange(p.start, p.end)}</Small>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Small s={9} c={C.tx2} w={500} lines={1}>
                  {p.title}
                </Small>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {o.stats ? <StatChips items={hs.map((h) => ({ color: habitColor(h).fill, label: `${h.name} ${plural(doneDays(h, first, last, t), 'day')}` }))} /> : null}
      <Footer>
        <Legend by={o.by} />
      </Footer>
    </View>
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
    const mo = pd(days[0]).getMonth();
    return i === 0 || pd(cols[i - 1][0]).getMonth() !== mo ? MONTHS[mo] : '';
  });
  const milestones = visiblePlans(S.meta.plans.filter((p) => p.milestone)).sort((a, b) => (a.start < b.start ? -1 : 1));
  return (
    <View style={card}>
      <Header over={ch ? `Chapter ${ch.n}: ${ch.name}` : 'The chapter year'} title="Year Wall" under={`Week ${cw} of ${WEEKS} · ${plural(pw.count, 'perfect week')} · ${plural(st.active, 'active day')}`} />
      <View>
        {/* Month labels sit over their first week; each column is 5 px plus a 1 px gap. */}
        <View style={{ height: 10 }}>
          {labels.map((l, i) =>
            l ? (
              <T key={i} s={6.5} w={600} c={C.mut2} style={{ position: 'absolute', left: i * 6, top: 0, lineHeight: 9 }}>
                {l}
              </T>
            ) : null,
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 1 }}>
          {cols.map((days, i) => (
            <View key={i} style={{ gap: 1 }}>
              {days.map((d) => (
                <View key={d} style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: dayColor(d, o, t), ...(d === t ? { borderWidth: 1, borderColor: C.lit } : {}) }} />
              ))}
            </View>
          ))}
        </View>
      </View>
      {!o.hidePlans && milestones.length ? (
        <View style={{ gap: 3 }}>
          <Small s={9}>Milestones</Small>
          {milestones.slice(0, 4).map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 2, backgroundColor: CAT[p.cat].color }} />
              <Small s={9}>{fmt(p.start)}</Small>
              <View style={{ flexShrink: 1, minWidth: 0 }}>
                <Small s={9} c={C.tx2} w={500} lines={1}>
                  {p.title}
                </Small>
              </View>
              {p.outcome === 'done' ? (
                <Small s={9} c={C.ok}>
                  ✓
                </Small>
              ) : null}
            </View>
          ))}
        </View>
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
    </View>
  );
}
