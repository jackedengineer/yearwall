// Web version of src/screens/year.tsx (ported from the phone app).
import { router } from '@web/lib/router';
import Feather from '@web/lib/icons';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { css, Pressable, StyleSheet, View } from '@web/lib/rn';
import { openWeek } from '@web/components/open-week';
import { useDragToPlan } from '@web/components/drag-plan';
import { reducedMotion, useMediaQuery } from '@web/lib/media';
import { perfectWeeks, plansInWeek, spotlightBar, weekProgress, yearProgress } from '@core/utils/progress';
import { setSpotlight, setYearView, spotlightHabit, toggleCategory } from '@web/lib/view-state';
import { colorVars } from '@web/components/habit-card';
import type { Habit } from '@core/data/types';
import { Card, Chip, Field, Screen, Section, T } from '@web/ui';
import { CATS } from '@core/constants';
import { commit, S, UI } from '@core/data/state';
import { actions } from '@core/data/store';
import { useStore } from '@web/lib/use-store';
import { C } from '@web/lib/theme';
import { addD, clampWeek, dowI, ds, fmt, fmtRange, MONTHS, pd, plural, todayS, weekDays, weekOf, weekStart, YEAR_END, YEAR_START } from '@core/utils/dates';
import { barColor, capOn, chapterLabelForMonth, isPerfect, monthsOfYear, yearStats } from '@core/utils/logic';

const WeekCard = memo(function WeekCard({ w, now, perfect, bars, spot }: { w: number; now: boolean; perfect: boolean; bars: { date: string; color: string; cap: string | null; today: boolean }[]; spot?: string }) {
  const days = weekDays(w);
  const focus = S.meta.weeks[String(w)]?.focus;
  const nPlans = plansInWeek(w).length;
  return (
    <Pressable
      nativeID={`wk-${w}`}
      onPress={() => openWeek(w)}
      accessibilityRole="button"
      accessibilityLabel={`Open week ${w}, ${fmtRange(days[0], days[6])}, ${plural(nPlans, 'plan')}${focus ? `, ${focus}` : ''}${perfect ? ', perfect week' : ''}`}
      style={({ pressed }) => [s.wk, now && s.wkNow, perfect && (now ? s.wkNowPerfect : s.wkPerfect), pressed && { opacity: 0.7 }]}
    >
      <View style={s.wl}>
        <T w={600} s={10} c={C.mut2}>
          W{w}
        </T>
        {spot ? (
          <T w={700} s={10} c={C.tx2}>
            {spot}
          </T>
        ) : now ? (
          <View style={s.nowb}>
            <T w={700} s={8} c={C.bg} style={{ lineHeight: 10 }}>
              Now
            </T>
          </View>
        ) : null}
      </View>
      <View style={s.bars}>
        {bars.map((b) => (
          <div key={b.date} data-date={b.date} className="v daybar" style={css([s.bar, { backgroundColor: b.color }, b.today && s.barToday])}>
            {b.cap ? <View style={[s.cap, { backgroundColor: b.cap }, spot !== undefined && { opacity: 0.3 }]} /> : null}
          </div>
        ))}
      </View>
    </Pressable>
  );
});

function WeeksBoard({ spot }: { spot: Habit | null }) {
  const t = todayS();
  const cw = weekOf(t);
  return (
    <View style={{ gap: 8 }}>
      {monthsOfYear().map((mo) => (
        <View key={`${mo.y}-${mo.m}`} style={s.mrow}>
          <View style={s.mlabel}>
            <T w={700} s={13}>
              {MONTHS[mo.m]}
            </T>
            <T w={600} s={9} c={C.mut} style={{ lineHeight: 11 }}>
              {chapterLabelForMonth(mo.y, mo.m)}
            </T>
          </View>
          <View style={s.weeks}>
            {[0, 1, 2, 3, 4].map((i) => {
              const w = mo.weeks[i];
              if (!w) return <View key={i} style={{ flex: 1 }} />;
              const bars = weekDays(w).map((d) => ({ date: d, color: spot ? spotlightBar(spot, d, t) : barColor(d, t), cap: capOn(d), today: d === t }));
              // In the spotlight, each week that has started says how many days the habit hit.
              const p = spot && w <= cw ? weekProgress(spot, t, w) : null;
              const label = spot ? (p && p.target ? `${p.done}/${p.target}` : '') : undefined;
              return (
                <View key={i} style={{ flex: 1 }}>
                  <WeekCard w={w} now={w === cw} perfect={!spot && w <= cw && isPerfect(w, t)} bars={bars} spot={label} />
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function DaysBoard({ spot }: { spot: Habit | null }) {
  const t = todayS();
  const months: [number, number][] = [];
  let y = pd(YEAR_START).getFullYear();
  let m = pd(YEAR_START).getMonth();
  const end = pd(YEAR_END);
  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
    months.push([y, m]);
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 }}>
      {months.map(([yy, mm]) => {
        const first = ds(new Date(yy, mm, 1));
        const nDays = new Date(yy, mm + 1, 0).getDate();
        const cells: (string | null)[] = Array(dowI(first)).fill(null);
        for (let i = 1; i <= nDays; i++) cells.push(ds(new Date(yy, mm, i)));
        return (
          <View key={`${yy}-${mm}`} style={{ width: '48%', gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
              <T w={700} s={12}>
                {MONTHS[mm]}
                {mm === 0 || (yy === pd(YEAR_START).getFullYear() && mm === pd(YEAR_START).getMonth()) ? ` ${yy}` : ''}
              </T>
              <T w={600} s={9} c={C.mut} numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
                {chapterLabelForMonth(yy, mm)}
              </T>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((d, i) => (
                <View key={i} style={{ width: `${100 / 7}%` as `${number}%`, padding: 1.5 }}>
                  {d ? (
                    d < YEAR_START || d > YEAR_END ? (
                      <View style={[s.cd, { backgroundColor: '#100F0E' }]} />
                    ) : (
                      <button
                        type="button"
                        data-date={d}
                        className="v press daycell"
                        onClick={() => {
                          // Past days open in Today to log them; future days open their week to plan.
                          if (d <= t) {
                            UI.day = d;
                            commit();
                            router.navigate('/');
                          } else openWeek(weekOf(d), { from: d, to: d, focus: 'plan' });
                        }}
                        aria-label={d <= t ? `Log ${fmt(d, { wd: true })}` : `Add plan on ${fmt(d, { wd: true })}`}
                        style={css([s.cd, { backgroundColor: spot ? spotlightBar(spot, d, t) : barColor(d, t) }, d === t && s.cdToday])}
                      >
                        {capOn(d) ? <View style={[s.cap, { height: 3, backgroundColor: capOn(d)! }, spot && { opacity: 0.3 }]} /> : null}
                      </button>
                    )
                  ) : (
                    <View style={{ aspectRatio: 1 }} />
                  )}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function GoalCard({ q, now }: { q: 1 | 2 | 3 | 4; now: boolean }) {
  const g = S.meta.goals[`q${q}`];
  const [text, setText] = useState(g.text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const ws = (q - 1) * 13 + 1;
  const we = q * 13;
  return (
    <Card style={[{ padding: 14, gap: 8 }, now && { borderColor: '#55504B' }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <T w={700} s={13}>
          Q{q} goals{' '}
          <T s={11} c={C.mut}>
            {fmt(weekStart(ws))} – {fmt(addD(weekStart(we), 6))}
          </T>
        </T>
        <Chip label={g.done ? 'Done' : now ? 'Now' : 'Mark done'} on={g.done} onPress={() => actions.saveGoal(q, { done: !g.done, text })} />
      </View>
      <Field
        value={text}
        onChangeText={(v) => {
          setText(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => actions.saveGoal(q, { text: v }, true), 500);
        }}
        onBlur={() => actions.saveGoal(q, { text }, true)}
        placeholder="What would make this quarter count?"
        multiline
        style={{ minHeight: 56, fontSize: 14 }}
      />
    </Card>
  );
}

export function Year() {
  useStore();
  const t = todayS();
  const cw = clampWeek(weekOf(t));
  const yp = yearProgress(t);
  const st = yearStats(t);
  const pw = perfectWeeks(t);
  const spot = spotlightHabit();
  // Dragging needs a mouse or pen; touch screens get tap wording.
  const finePointer = useMediaQuery('(pointer: fine)');
  // Esc leaves the spotlight (unless a dialog or menu is open and wants it).
  useEffect(() => {
    if (!spot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role=dialog], [role=alertdialog], [role=menu]')) setSpotlight('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [spot]);
  const q = Math.min(4, Math.floor((cw - 1) / 13) + 1);
  const board = useRef<HTMLDivElement>(null);
  const planRange = useCallback((a: string, b: string, x: number) => openWeek(clampWeek(weekOf(a)), { from: a, to: b, focus: 'plan', x }), []);
  useDragToPlan(board, planRange);
  /** Scroll to the current week and open it. */
  const showThisWeek = () => {
    if (UI.yearView !== 'weeks') setYearView('weeks');
    requestAnimationFrame(() => {
      const el = document.getElementById(`wk-${cw}`);
      el?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
      el?.focus({ preventScroll: true });
      const r = el?.getBoundingClientRect();
      openWeek(cw, { x: r ? r.left + r.width / 2 : undefined });
    });
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <T w={700} s={24} style={{ flexShrink: 1, lineHeight: 30 }}>
          Year Wall
        </T>
        <Chip label="Share" onPress={() => router.push({ pathname: '/share', params: { kind: 'year' } })} />
      </View>

      <div className="yprog" role="group" aria-label="Year progress">
        <div className="yprog-text">
          <span className="yprog-week">{yp.started ? `Week ${yp.week} of ${yp.weeks}` : `The year starts ${fmt(YEAR_START, { wd: true })}`}</span>
          <span>
            {plural(yp.daysLeft, 'day')} left · {yp.pct}% gone
          </span>
        </div>
        <div className="yprog-bar" role="progressbar" aria-label="Share of the chapter year gone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={yp.pct}>
          <span style={{ width: `${Math.max(1, yp.pct)}%` }} />
        </div>
      </div>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={[s.stat, { backgroundColor: C.okBg, borderColor: C.okLine, flex: 1.6 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <T w={700} s={20} c={C.ok}>
              {pw.count}
            </T>
            <T s={11} w={600} c="#8CC7A4">
              {pw.count === 1 ? 'perfect week' : 'perfect weeks'}
              {pw.bestRun > 0 ? `, best run ${plural(pw.bestRun, 'week')}` : ''}
            </T>
          </View>
          <T s={11} c="#7FB596" style={{ marginTop: 2 }}>
            A week where every habit hits its target.
          </T>
        </View>
        <View style={s.stat}>
          <T w={700} s={20}>
            {st.best}
          </T>
          <T s={11} c={C.mut}>
            best streak, days
          </T>
        </View>
        <View style={s.stat}>
          <T w={700} s={20}>
            {st.active}
          </T>
          <T s={11} c={C.mut}>
            active days
          </T>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <View style={s.seg}>
          {(['weeks', 'days'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setYearView(v)}
              accessibilityRole="button"
              accessibilityState={{ selected: UI.yearView === v }}
              style={[s.segBtn, UI.yearView === v && { backgroundColor: C.line }]}
            >
              <T w={600} s={12} c={UI.yearView === v ? C.tx : C.mut}>
                {v === 'weeks' ? 'Weeks' : 'Days'}
              </T>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <T s={12} c={C.mut} style={{ flexShrink: 1 }}>
            {finePointer
              ? UI.yearView === 'weeks'
                ? 'Click a week to open it. Drag across days to plan.'
                : 'Click a day to log it. Drag across days to plan.'
              : UI.yearView === 'weeks'
                ? 'Tap a week to open it.'
                : 'Tap a day to log or plan it.'}
          </T>
          <Chip label="This week" onPress={showThisWeek} />
        </View>
      </View>

      <div className="showcats" role="group" aria-label="Show plan categories on the board">
        <span className="showcats-label">Show</span>
        {CATS.map((c) => {
          const shown = !UI.hideCats.has(c.id);
          return (
            <button key={c.id} type="button" className={shown ? 'catchip' : 'catchip off'} aria-pressed={shown} onClick={() => toggleCategory(c.id)}>
              <span className="dot" style={{ background: c.color }} />
              {c.name}
            </button>
          );
        })}
      </div>

      {spot ? (
        <div className="spotbar" style={colorVars(spot)} role="status">
          <span className="dot" style={{ background: 'var(--hc)' }} />
          <span className="spotbar-text">
            <strong>{spot.name}</strong> only: filled days are done, and each week shows how many days it hit. Plans are dimmed. {finePointer ? 'Press Esc or × to see every habit.' : 'Tap × to see every habit.'}
          </span>
          <button type="button" className="icon-btn" aria-label="Show every habit" onClick={() => setSpotlight('')}>
            <Feather name="x" size={16} />
          </button>
        </div>
      ) : null}

      <div ref={board} className="board">
        {UI.yearView === 'weeks' ? <WeeksBoard spot={spot} /> : <DaysBoard spot={spot} />}
      </div>

      <Section left="Quarter goals" right="Chapter year quarters" />
      {([1, 2, 3, 4] as const).map((qq) => (
        <GoalCard key={qq} q={qq} now={qq === q} />
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  stat: { flex: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.s2, borderWidth: 1, borderColor: C.line },
  seg: { flexDirection: 'row', backgroundColor: C.s2, borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 3 },
  segBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 7 },
  mrow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  mlabel: { width: 44, paddingTop: 6, gap: 2 },
  weeks: { flex: 1, flexDirection: 'row', gap: 6 },
  wk: { height: 62, borderRadius: 10, backgroundColor: C.s1, borderWidth: 1, borderColor: C.off, padding: 6, justifyContent: 'space-between' },
  wkNow: { borderColor: C.lit, borderWidth: 2, padding: 5 },
  wkPerfect: { borderColor: C.perfect, borderWidth: 2, padding: 5 },
  wkNowPerfect: { borderColor: C.ok, borderWidth: 2, padding: 5 },
  wl: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nowb: { backgroundColor: C.lit, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 },
  bars: { flexDirection: 'row', gap: 2, height: 28 },
  bar: { flex: 1, borderRadius: 2, overflow: 'hidden' },
  barToday: { borderWidth: 1, borderColor: C.lit },
  cap: { position: 'absolute', left: 0, right: 0, top: 0, height: 6 },
  cd: { aspectRatio: 1, borderRadius: 4, overflow: 'hidden' },
  cdToday: { borderWidth: 1.5, borderColor: C.lit },
});
