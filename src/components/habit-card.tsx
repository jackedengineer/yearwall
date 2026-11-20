/**
 * One habit on the phone: a round tick button in the habit's colour, its
 * streak, this week as 7 segments (today larger and outlined), and "3 of 6
 * this week" (or "30 of 240 min today", which opens exact entry). The eye
 * spotlights it on the Year board; ··· has Edit, Archive and Delete.
 *
 * Motion: the ring pops (0.85 -> 1.08 -> 1, 260 ms) when a tap logs more, and
 * the card's tint and border fade in 150 ms. Both are skipped with reduced motion.
 */
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { commit, S, UI } from '@/data/state';
import type { Habit } from '@/data/types';
import { C, CONTROL_LINE, MOTION } from '@/theme';
import { clampWeek, DOW, fmt, todayS, weekOf } from '@/utils/dates';
import { doneOn, isActive, streak, targetOn, valueOn } from '@/utils/logic';
import { habitColor, isRunning, progressLine, weekStrip, type DayState } from '@/utils/progress';
import { ActionSheet } from './action-sheet';
import { archiveHabit, deleteHabit, logHabit } from './habit-actions';
import { TourTarget } from './tour';
import { T } from './ui';

const STATE_WORDS: Record<DayState, string> = { done: 'done', partial: 'partly done', missed: 'missed', empty: 'not done', future: 'coming up', off: 'off' };
const POP = { '0%': { transform: [{ scale: MOTION.pop.scales[0] }] }, '60%': { transform: [{ scale: MOTION.pop.scales[1] }] }, '100%': { transform: [{ scale: MOTION.pop.scales[2] }] } };
const popEase = cubicBezier(...MOTION.pop.bezier);

export function Flame({ size = 13, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2.5c.9 2.6 3.2 4.3 4.4 6.4a7 7 0 0 1 .9 3.6 5.3 5.3 0 0 1-10.6 0c0-1.9.8-3.3 1.8-4.4.1 1.4.8 2.5 2 2.8-.6-3 .3-5.8 1.5-8.4z" />
    </Svg>
  );
}

/** The round tick button. Minute habits show progress as an arc until they're done. */
export function Ring({ h, d, size = 48 }: { h: Habit; d: string; size?: number }) {
  const [pops, setPops] = useState(0);
  const reduced = useReducedMotion();
  const c = habitColor(h);
  const val = valueOn(h, d);
  const tgt = targetOn(h, d);
  const done = doneOn(h, d);
  const t = todayS();
  const future = d > t;
  const auto = h.auto === 'journal';
  const when = d === t ? 'today' : fmt(d, { wd: true });
  const label = auto
    ? `${h.name} for ${when}, ${done ? 'done' : 'not done'}. Ticks itself when you write the log. Opens the log.`
    : h.type === 'minutes'
      ? `Add ${h.step || 1} minutes of ${h.name} for ${when}, ${val} of ${tgt} so far`
      : `Log ${h.name} for ${when}`;
  const r = size / 2 - 3;
  const circ = 2 * Math.PI * r;
  const frac = Math.min(1, val / Math.max(1, tgt));
  return (
    <Pressable
      disabled={future}
      onPress={() => {
        if (logHabit(h, d)) setPops((n) => n + 1);
      }}
      accessibilityRole={h.type === 'check' && !auto ? 'checkbox' : 'button'}
      accessibilityState={h.type === 'check' && !auto ? { checked: done, disabled: future } : { disabled: future }}
      accessibilityLabel={label}
      hitSlop={4}
      style={{ width: size, height: size, opacity: future ? 0.35 : 1 }}
    >
      {/* Re-keyed on every log, so the pop restarts even mid-animation. Focus stays on the Pressable. */}
      <Animated.View
        key={pops}
        style={[
          { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? c.fill : 'transparent' },
          pops > 0 && !reduced && { animationName: POP, animationDuration: MOTION.pop.ms, animationTimingFunction: popEase },
        ]}
      >
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={done ? c.fill : c.line} strokeWidth={2.5} />
          {!done && frac > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={c.fill}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${circ * frac} ${circ}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        {done ? (
          <Feather name="check" size={Math.round(size * 0.45)} color={C.bg} />
        ) : auto ? (
          <Feather name="edit-3" size={Math.round(size * 0.36)} color={c.fill} />
        ) : h.type === 'minutes' ? (
          <T w={700} s={11} c={c.fill} style={{ letterSpacing: -0.2 }}>
            +{h.step || 1}
          </T>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/** The week holding `d`, judged against the real today (so past days never show as "coming up"). */
export function WeekStrip({ h, d }: { h: Habit; d: string }) {
  const c = habitColor(h);
  const days = weekStrip(h, todayS(), clampWeek(weekOf(d)));
  const summary = days.map((x, i) => `${DOW[i]} ${STATE_WORDS[x.state]}`).join(', ');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`This week: ${summary}`} style={s.strip}>
      {days.map((x) => {
        const st = x.state;
        const look =
          st === 'done'
            ? { backgroundColor: c.fill }
            : st === 'partial'
              ? { backgroundColor: c.dim, borderWidth: 1, borderColor: c.fill }
              : st === 'missed'
                ? { backgroundColor: CONTROL_LINE }
                : st === 'empty'
                  ? { borderWidth: 1, borderColor: CONTROL_LINE }
                  : st === 'future'
                    ? { backgroundColor: '#1A1817' }
                    : { borderWidth: 1, borderStyle: 'dashed' as const, borderColor: '#33302D' };
        return <View key={x.date} style={[s.cap, look, x.today && { height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: c.fill }]} />;
      })}
    </View>
  );
}

/** Eye: show only this habit on the Year board. */
export function SpotlightButton({ h }: { h: Habit }) {
  const on = UI.spotlight === h.id;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`Spotlight ${h.name} on the board`}
      hitSlop={4}
      style={({ pressed }) => [s.icon, on && { backgroundColor: C.s4 }, pressed && { opacity: 0.6 }]}
      onPress={() => {
        UI.spotlight = on ? '' : h.id;
        commit();
        if (!on) router.navigate('/year');
      }}
    >
      <Feather name="eye" size={17} color={on ? C.tx : C.mut} />
    </Pressable>
  );
}

function MoreButton({ h }: { h: Habit }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`More for ${h.name}`} hitSlop={4} style={({ pressed }) => [s.icon, pressed && { opacity: 0.6 }]} onPress={() => setOpen(true)}>
        <Feather name="more-horizontal" size={18} color={C.mut} />
      </Pressable>
      <ActionSheet
        title={h.name}
        open={open}
        onClose={() => setOpen(false)}
        actions={[
          { label: 'Edit', icon: 'edit-2', onPress: () => router.push({ pathname: '/habit/[id]', params: { id: h.id } }) },
          ...(isRunning(h) ? [{ label: 'Archive', icon: 'archive' as const, onPress: () => archiveHabit(h) }] : []),
          { label: 'Delete', icon: 'trash-2', danger: true, onPress: () => void deleteHabit(h) },
        ]}
      />
    </>
  );
}

export function HabitCard({ h, d, first }: { h: Habit; d: string; first?: boolean }) {
  const reduced = useReducedMotion();
  const c = habitColor(h);
  const t = todayS();
  const done = doneOn(h, d);
  const st = streak(h, d <= t ? d : t);
  const line = progressLine(h, d);
  return (
    <Animated.View
      style={[
        s.card,
        done && { backgroundColor: c.tint, borderColor: c.line },
        !reduced && { transitionProperty: ['backgroundColor', 'borderColor'], transitionDuration: MOTION.fast },
      ]}
    >
      <Ring h={h} d={d} />
      <View style={s.main}>
        <View style={s.top}>
          <T w={600} s={15} numberOfLines={2} style={{ flexShrink: 1 }}>
            {h.name}
          </T>
          {st.n > 0 ? (
            <View accessible accessibilityRole="text" accessibilityLabel={`${st.n}-${st.unit} streak`} style={s.streak}>
              <Flame color={c.fill} />
              <T w={700} s={12} c={c.fill}>
                {st.n}
                {st.unit === 'week' ? 'w' : ''}
              </T>
            </View>
          ) : null}
        </View>
        {first ? (
          <TourTarget id="strip">
            <WeekStrip h={h} d={d} />
          </TourTarget>
        ) : (
          <WeekStrip h={h} d={d} />
        )}
        {h.type === 'minutes' && isActive(h, d) && d <= t ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${line}. Enter exact minutes`}
            hitSlop={{ top: 10, bottom: 10 }}
            style={{ alignSelf: 'flex-start' }}
            onPress={() => router.push({ pathname: '/minutes/[hid]', params: { hid: h.id, d } })}
          >
            <T s={12} c={C.mut} style={{ textDecorationLine: 'underline', textDecorationStyle: 'dotted' }}>
              {line}
            </T>
          </Pressable>
        ) : (
          <T s={12} c={C.mut}>
            {h.auto === 'journal' && !done && d === t ? "Ticks itself when you write tonight's log" : line}
          </T>
        )}
      </View>
      <View style={s.actions}>
        {first ? (
          <TourTarget id="spot">
            <SpotlightButton h={h} />
          </TourTarget>
        ) : (
          <SpotlightButton h={h} />
        )}
        <MoreButton h={h} />
      </View>
    </Animated.View>
  );
}

/** The habits active on day `d`, as cards. */
export function HabitCards({ d }: { d: string }) {
  const list = S.meta.habits.filter((h) => isActive(h, d));
  return (
    <TourTarget id="cards" style={{ gap: 10 }}>
      {list.map((h, i) => (
        <HabitCard key={h.id} h={h} d={d} first={i === 0} />
      ))}
    </TourTarget>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 6, backgroundColor: C.s2, borderWidth: 1, borderColor: C.line, borderRadius: 16 },
  main: { flex: 1, minWidth: 0, gap: 7 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 220 },
  cap: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#24211F' },
  actions: { gap: 2 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
