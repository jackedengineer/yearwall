// Web version of src/screens/year.tsx (ported from the phone app).
import { router } from '@web/lib/router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { css, Pressable, StyleSheet, View } from '@web/lib/rn';
import { openWeek } from '@web/components/open-week';
import { useDragToPlan } from '@web/components/drag-plan';
import { reducedMotion } from '@web/lib/media';
import { plansInWeek } from '@core/utils/progress';
import { Bar, Card, Chip, Chips, Field, Screen, Section, T } from '@web/ui';
import { CATS } from '@core/constants';
import { commit, S, UI } from '@core/data/state';
import { actions } from '@core/data/store';
import { useStore } from '@web/lib/use-store';
import { C } from '@web/lib/theme';
import { addD, clampWeek, diff, dowI, ds, fmt, fmtRange, MONTHS, pd, plural, todayS, weekDays, weekOf, weekStart, WEEKS, YEAR_END, YEAR_START } from '@core/utils/dates';
import { barColor, capOn, chapterLabelForMonth, isPerfect, monthsOfYear, yearStats } from '@core/utils/logic';

const WeekCard = memo(function WeekCard({ w, now, perfect, bars }: { w: number; now: boolean; perfect: boolean; bars: { date: string; color: string; cap: string | null; today: boolean }[] }) {
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
        {now ? (
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
            {b.cap ? <View style={[s.cap, { backgroundColor: b.cap }]} /> : null}
          </div>
        ))}
      </View>
    </Pressable>
  );
});

function WeeksBoard() {
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
              const bars = weekDays(w).map((d) => ({ date: d, color: barColor(d, t), cap: capOn(d), today: d === t }));
              return (
                <View key={i} style={{ flex: 1 }}>
                  <WeekCard w={w} now={w === cw} perfect={w <= cw && isPerfect(w, t)} bars={bars} />
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function DaysBoard() {
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
                        style={css([s.cd, { backgroundColor: barColor(d, t) }, d === t && s.cdToday])}
                      >
                        {capOn(d) ? <View style={[s.cap, { height: 3, backgroundColor: capOn(d)! }]} /> : null}
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
  const dayIdx = Math.max(0, Math.min(WEEKS * 7, diff(YEAR_START, t) + 1));
  const left = WEEKS * 7 - dayIdx;
  const pct = Math.round((dayIdx / (WEEKS * 7)) * 100);
  const st = yearStats(t);
  const q = Math.min(4, Math.floor((cw - 1) / 13) + 1);
  const board = useRef<HTMLDivElement>(null);
  const planRange = useCallback((a: string, b: string, x: number) => openWeek(clampWeek(weekOf(a)), { from: a, to: b, focus: 'plan', x }), []);
  useDragToPlan(board, planRange);
  /** Scroll to the current week and open it. */
  const showThisWeek = () => {
    if (UI.yearView !== 'weeks') {
      UI.yearView = 'weeks';
      commit();
    }
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

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T w={600} s={12}>
            Week {cw} of {WEEKS}
          </T>
          <T w={600} s={12} c={C.mut}>
            {plural(left, 'day')} left, {pct}% gone
          </T>
        </View>
        <Bar pct={Math.max(1, pct)} h={5} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={[s.stat, { backgroundColor: C.okBg, borderColor: C.okLine }]}>
          <T w={700} s={20} c={C.ok}>
            {st.perfect}
          </T>
          <T s={11} c="#8CC7A4">
            perfect weeks
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

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={s.seg}>
          {(['weeks', 'days'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => {
                UI.yearView = v;
                commit();
              }}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <T s={12} c={C.mut}>
            {UI.yearView === 'weeks' ? 'Click a week to open it. Drag across days to plan.' : 'Click a day to log it. Drag across days to plan.'}
          </T>
          <Chip label="This week" onPress={showThisWeek} />
        </View>
      </View>

      <Chips>
        {CATS.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            dot={c.color}
            dim={UI.hideCats.has(c.id)}
            onPress={() => {
              if (UI.hideCats.has(c.id)) UI.hideCats.delete(c.id);
              else UI.hideCats.add(c.id);
              commit();
            }}
          />
        ))}
      </Chips>

      <div ref={board} className="board">
        {UI.yearView === 'weeks' ? <WeeksBoard /> : <DaysBoard />}
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
