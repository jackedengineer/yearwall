import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GoalCard } from '@/components/goals';
import { startTour, TourTarget } from '@/components/tour';
import { Chip, Screen, Section, T } from '@/components/ui';
import { CATS } from '@/constants';
import { commit, S, UI } from '@/data/state';
import type { Habit } from '@/data/types';
import { useStore } from '@/hooks/use-store';
import { C } from '@/theme';
import { clampWeek, dowI, ds, fmt, fmtRange, MONTHS, pd, plural, todayS, weekDays, weekOf, YEAR_END, YEAR_START } from '@/utils/dates';
import { barColor, capOn, chapterLabelForMonth, dayScore, isPerfect, monthsOfYear, yearStats } from '@/utils/logic';
import { habitColor, perfectWeeks, plansInWeek, spotlightBar, weekProgress, yearProgress } from '@/utils/progress';

const spotlightHabit = (): Habit | null => (UI.spotlight ? (S.meta.habits.find((h) => h.id === UI.spotlight) ?? null) : null);
const setSpotlight = (id: string) => {
  UI.spotlight = id;
  commit();
};
const openWeek = (w: number) => router.push({ pathname: '/week/[w]', params: { w: String(w) } });

const WeekCard = memo(function WeekCard({ w, now, perfect, bars, spot, spotName }: { w: number; now: boolean; perfect: boolean; bars: { color: string; cap: string | null; today: boolean }[]; spot?: string; spotName?: string }) {
  const days = weekDays(w);
  const focus = S.meta.weeks[String(w)]?.focus;
  const nPlans = plansInWeek(w).length;
  // Text for what the bars show: days with every habit done (or the spotlighted habit's count).
  const t = todayS();
  const full = days.filter((d) => d <= t && dayScore(d) === 1).length;
  const barsText = spot ? `${spotName} ${spot.replace('/', ' of ')} days` : days[0] <= t ? `${plural(full, 'day')} with every habit done` : '';
  return (
    <Pressable
      onPress={() => openWeek(w)}
      accessibilityRole="button"
      accessibilityLabel={`W${w}${spot ? ` ${spot}` : now ? ' Now' : ''}, open week ${w}, ${fmtRange(days[0], days[6])}, ${plural(nPlans, 'plan')}${focus ? `, ${focus}` : ''}${perfect ? ', perfect week' : ''}${barsText ? `, ${barsText}` : ''}`}
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
        {bars.map((b, i) => (
          <View key={i} style={[s.bar, { backgroundColor: b.color }, b.today && s.barToday]}>
            {b.cap ? <View style={[s.cap, { backgroundColor: b.cap }, spot !== undefined && { opacity: 0.3 }]} /> : null}
          </View>
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
              const bars = weekDays(w).map((d) => ({ color: spot ? spotlightBar(spot, d, t) : barColor(d, t), cap: capOn(d), today: d === t }));
              // In the spotlight, each week that has started says how many days the habit hit.
              const p = spot && w <= cw ? weekProgress(spot, t, w) : null;
              const label = spot ? (p && p.target ? `${p.done}/${p.target}` : '') : undefined;
              return (
                <View key={i} style={{ flex: 1 }}>
                  {w === cw ? (
                    <TourTarget id="week">
                      <WeekCard w={w} now perfect={!spot && isPerfect(w, t)} bars={bars} spot={label} spotName={spot?.name} />
                    </TourTarget>
                  ) : (
                    <WeekCard w={w} now={false} perfect={!spot && w <= cw && isPerfect(w, t)} bars={bars} spot={label} spotName={spot?.name} />
                  )}
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
                    <Pressable
                      disabled={d > t || d < YEAR_START || d > YEAR_END}
                      onPress={() => {
                        UI.day = d;
                        commit();
                        router.navigate('/');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Log ${fmt(d, { wd: true })}`}
                      style={[s.cd, { backgroundColor: d < YEAR_START || d > YEAR_END ? '#100F0E' : spot ? spotlightBar(spot, d, t) : barColor(d, t) }, d === t && s.cdToday]}
                    >
                      {capOn(d) && d >= YEAR_START && d <= YEAR_END ? <View style={[s.cap, { height: 3, backgroundColor: capOn(d)! }]} /> : null}
                    </Pressable>
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

export function Year() {
  useStore();
  const t = todayS();
  const cw = clampWeek(weekOf(t));
  const yp = yearProgress(t);
  const st = yearStats(t);
  const pw = perfectWeeks(t);
  const spot = spotlightHabit();

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <T w={700} s={24} accessibilityRole="header" style={{ flexShrink: 1, lineHeight: 30 }}>
          Year Wall
        </T>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip label="How it works" onPress={startTour} />
          <TourTarget id="share">
            <Chip label="Share" onPress={() => router.push({ pathname: '/share', params: { kind: 'year' } })} />
          </TourTarget>
        </View>
      </View>

      <View style={{ gap: 8 }} accessible accessibilityRole="progressbar" accessibilityLabel="Year progress" accessibilityValue={{ min: 0, max: 100, now: yp.pct, text: `${yp.started ? `Week ${yp.week} of ${yp.weeks}` : 'Not started'}, ${plural(yp.daysLeft, 'day')} left, ${yp.pct}% gone` }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <T w={600} s={12}>
            {yp.started ? `Week ${yp.week} of ${yp.weeks}` : `The year starts ${fmt(YEAR_START, { wd: true })}`}
          </T>
          <T w={600} s={12} c={C.mut}>
            {plural(yp.daysLeft, 'day')} left · {yp.pct}% gone
          </T>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: C.off, overflow: 'hidden' }}>
          <View style={{ width: `${Math.max(1, yp.pct)}%` as `${number}%`, height: '100%', borderRadius: 3, backgroundColor: C.lit }} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TourTarget id="perfect" style={[s.stat, { backgroundColor: C.okBg, borderColor: C.okLine, flex: 1.7 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <T w={700} s={20} c={C.ok}>
              {pw.count}
            </T>
            <T s={11} w={600} c="#8CC7A4" style={{ flexShrink: 1 }}>
              {pw.count === 1 ? 'perfect week' : 'perfect weeks'}
              {pw.bestRun > 0 ? `, best run ${plural(pw.bestRun, 'week')}` : ''}
            </T>
          </View>
          <T s={11} c="#7FB596" style={{ marginTop: 2 }}>
            A week where every habit hits its target.
          </T>
        </TourTarget>
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

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
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
        <Chip label="This week" onPress={() => openWeek(cw)} />
      </View>
      <T s={12} c={C.mut} style={{ marginTop: -8 }}>
        {UI.yearView === 'weeks' ? 'Tap a week to open it and plan its days.' : 'Tap a day to log it.'}
      </T>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }} accessibilityLabel="Show plan categories on the board">
        <T w={600} s={12} c={C.mut} style={{ marginRight: 2 }}>
          Show
        </T>
        {CATS.map((c) => {
          const shown = !UI.hideCats.has(c.id);
          return (
            <Pressable
              key={c.id}
              accessibilityRole="switch"
              accessibilityState={{ checked: shown }}
              accessibilityLabel={c.name}
              hitSlop={{ top: 6, bottom: 6 }}
              onPress={() => {
                if (shown) UI.hideCats.add(c.id);
                else UI.hideCats.delete(c.id);
                commit();
              }}
              style={({ pressed }) => [s.cat, !shown && { opacity: 0.55 }, pressed && { opacity: 0.6 }]}
            >
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: shown ? c.color : C.mut2 }} />
              <T s={12} w={500} c={shown ? '#D6D1CB' : C.mut} style={!shown && { textDecorationLine: 'line-through' }}>
                {c.name}
              </T>
            </Pressable>
          );
        })}
      </View>

      {spot ? (
        <View style={[s.spotbar, { borderColor: habitColor(spot).line, backgroundColor: habitColor(spot).tint }]} accessibilityLiveRegion="polite">
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: habitColor(spot).fill }} />
          <T s={12} c={C.tx2} style={{ flex: 1 }}>
            <T w={700} s={12}>
              {spot.name}
            </T>{' '}
            only: filled days are done, and each week shows how many days it hit. Plans are dimmed. Tap × to see every habit.
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel="Show every habit" hitSlop={6} onPress={() => setSpotlight('')} style={s.spotx}>
            <Feather name="x" size={16} color={C.tx2} />
          </Pressable>
        </View>
      ) : null}

      <TourTarget id="board">{UI.yearView === 'weeks' ? <WeeksBoard spot={spot} /> : <DaysBoard spot={spot} />}</TourTarget>

      <Section left="Quarter goals" right="Up to 5 a quarter" />
      <TourTarget id="goals" style={{ gap: 12 }}>
        {([1, 2, 3, 4] as const).map((qq) => (
          <GoalCard key={qq} q={qq} />
        ))}
      </TourTarget>
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
  cat: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, minHeight: 36, borderRadius: 999, backgroundColor: C.s3, borderWidth: 1, borderColor: '#2E2B28' },
  spotbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 4, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  spotx: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
