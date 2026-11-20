/**
 * One week: focus, a habit grid in each habit's colour (tickable back to Day 0),
 * quick add with Mon–Sun chips, the plans day by day (× with Undo, and "Did it
 * happen?" once they're over), and notes. ‹ › move between weeks in place.
 * Opened from the board with ?from=&to= to pre-fill "When".
 */
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, type TextInputInstance, View } from 'react-native';
import { PlanOutcome } from '@/components/plan-outcome';
import { toast } from '@/components/toast';
import { Btn, Card, Chip, Chips, Field, IconBtn, ModalScreen, T } from '@/components/ui';
import { CAT, CATS } from '@/constants';
import { commit, S, UI } from '@/data/state';
import { actions } from '@/data/store';
import type { CatId, Habit, Plan } from '@/data/types';
import { useStore } from '@/hooks/use-store';
import { C, CONTROL_LINE } from '@/theme';
import { addD, clampWeek, DOW, dowI, fmt, fmtRange, isDate, pd, plural, todayS, weekDays, weekOf, WEEKS } from '@/utils/dates';
import { doneOn, isActive, journalOn, plansOn, targetOn, valueOn } from '@/utils/logic';
import { habitColor, logMessage, plansInWeek, weekProgress, whenLabel } from '@/utils/progress';

function toggleDay(h: Habit, d: string) {
  if (h.type === 'minutes' && doneOn(h, d)) {
    router.push({ pathname: '/minutes/[hid]', params: { hid: h.id, d } });
    return;
  }
  const before = valueOn(h, d);
  const after = doneOn(h, d) ? 0 : targetOn(h, d);
  actions.setValue(h, d, after);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  toast({ message: logMessage(h, d, before, after, todayS()), undo: () => actions.setValue(h, d, before) });
}

function HabitGrid({ days }: { days: string[] }) {
  const t = todayS();
  const hs = S.meta.habits.filter((h) => days.some((d) => isActive(h, d)));
  if (!hs.length)
    return (
      <T s={13} c={C.mut}>
        No habits are scheduled this week.
      </T>
    );
  // On a phone each habit gets its own line for the name and a full-width row of days below it.
  return (
    <View style={{ gap: 12 }}>
      <View style={g.days} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {days.map((d, i) => (
          <T key={d} w={d === t ? 700 : 600} s={11} c={d === t ? C.tx : C.mut} style={{ flex: 1, textAlign: 'center' }}>
            {DOW[i]}
          </T>
        ))}
      </View>
      {hs.map((h) => {
        const c = habitColor(h);
        const p = weekProgress(h, t < days[6] ? t : days[6], weekOf(days[0]));
        return (
          <View key={h.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.fill }} />
              <T w={600} s={13} numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header">
                {h.name}
              </T>
              <T s={12} c={C.mut} accessibilityLabel={`${p.done} of ${p.target} done`}>
                {p.done}/{p.target}
              </T>
            </View>
            <View style={g.days}>
              {days.map((d) => {
                const active = isActive(h, d);
                const done = active && doneOn(h, d);
                const part = active && !done && valueOn(h, d) > 0;
                const auto = h.auto === 'journal';
                const off = !active || d > t;
                const look = !active
                  ? { borderColor: C.line2, opacity: 0.35 }
                  : done
                    ? { backgroundColor: c.fill, borderColor: c.fill }
                    : part
                      ? { backgroundColor: c.dim, borderColor: c.fill }
                      : d > t
                        ? { backgroundColor: '#1A1817', borderColor: C.line2 }
                        : { borderColor: CONTROL_LINE };
                const label = `${h.type === 'minutes' && done ? 'Change minutes of' : 'Log'} ${h.name} for ${fmt(d, { wd: true })}${
                  !active ? ', not scheduled' : auto ? `, ${done ? 'done' : 'not done'}, ticks itself from the log` : h.type === 'minutes' ? `, ${valueOn(h, d)} of ${targetOn(h, d)} min` : ''
                }`;
                return (
                  <Pressable
                    key={d}
                    disabled={off || auto}
                    onPress={() => toggleDay(h, d)}
                    accessibilityRole={h.type === 'check' ? 'checkbox' : 'button'}
                    accessibilityState={{ checked: h.type === 'check' ? done : undefined, disabled: off || auto }}
                    accessibilityLabel={label}
                    style={[g.cell, look, d === t && { borderWidth: 1.5 }]}
                  >
                    {done ? <Feather name="check" size={14} color={C.bg} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function QuickAdd({ w, days, from: rawFrom, to: rawTo }: { w: number; days: string[]; from?: string; to?: string }) {
  const t = todayS();
  const from = rawFrom && isDate(rawFrom) ? rawFrom : undefined;
  const to = rawTo && isDate(rawTo) ? rawTo : undefined;
  const [title, setTitle] = useState('');
  const [range, setRange] = useState<{ start: string; end: string } | null>(from ? { start: from, end: to && to >= from ? to : from } : null);
  const [cat, setCat] = useState<CatId>('work');
  const input = useRef<TextInputInstance>(null);

  useEffect(() => {
    setRange(from ? { start: from, end: to && to >= from ? to : from } : null);
  }, [w, from, to]);

  const on = (d: string) => !!range && d >= range.start && d <= range.end;
  const toggle = (d: string) => {
    Haptics.selectionAsync().catch(() => {});
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
    <Card style={{ padding: 14, gap: 10, backgroundColor: 'transparent' }}>
      <Field
        ref={input}
        label="Add a plan"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Client call, mini-retreat day"
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={add}
      />
      <T s={12} c={C.mut} accessibilityLiveRegion="polite">
        When: <T s={12} w={700}>{when}</T>
      </T>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {days.map((d, i) => {
          const sel = on(d);
          return (
            <Pressable
              key={d}
              onPress={() => toggle(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={fmt(d, { wd: true })}
              style={{ flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: sel ? C.lit : '#2E2B28', backgroundColor: sel ? C.lit : C.s3 }}
            >
              <T w={600} s={11} c={sel ? C.bg : C.tx2}>
                {DOW[i]}
              </T>
            </Pressable>
          );
        })}
      </View>
      <Chips>
        {CATS.map((c) => (
          <Chip key={c.id} label={c.name} dot={c.color} on={cat === c.id} onPress={() => setCat(c.id)} />
        ))}
      </Chips>
      <Btn label="Add plan" onPress={add} disabled={!title.trim()} />
    </Card>
  );
}

function removePlan(p: Plan) {
  const gone = actions.deletePlan(p.id);
  if (gone) toast({ message: `Removed "${p.title}".`, undo: () => actions.savePlan(gone), focus: true });
}

function DayList({ days }: { days: string[] }) {
  const t = todayS();
  const posts = S.posts.filter((p) => days.includes(p.date));
  const posted = posts.filter((p) => p.status === 'Posted').length;
  const ended = plansInWeek(weekOf(days[0])).filter((p) => (p.end || p.start) < t);
  const happened = ended.filter((p) => p.outcome === 'done').length;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <T w={600} s={13} c={C.mut} accessibilityRole="header" style={{ flexShrink: 1 }}>
          Days{ended.length ? ` · ${happened} of ${ended.length} plans happened` : ''}
        </T>
        <T w={600} s={13} c={C.mut}>
          {plural(posts.length, 'post')}, {posted} posted
        </T>
      </View>
      {days.map((d) => {
        const ps = plansOn(d);
        const po = posts.filter((p) => p.date === d);
        const j = journalOn(d);
        const today = d === t;
        return (
          <View key={d} style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line2 }}>
            <Pressable
              disabled={d > t}
              onPress={() => {
                UI.day = d;
                commit();
                router.dismissTo('/');
              }}
              accessibilityRole="button"
              accessibilityLabel={`${DOW[dowI(d)]} ${pd(d).getDate()}, open ${fmt(d)} in Today`}
              style={{ width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: today ? C.lit : C.s3, opacity: d > t ? 0.6 : 1 }}
            >
              <T w={600} s={9} c={today ? '#4A4642' : C.mut} style={{ lineHeight: 11 }}>
                {DOW[dowI(d)]}
              </T>
              <T w={700} s={14} c={today ? C.bg : C.tx} style={{ lineHeight: 17 }}>
                {pd(d).getDate()}
              </T>
            </Pressable>
            <View style={{ flex: 1, gap: 8, paddingTop: 2 }}>
              {ps.map((p) => (
                <View key={p.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Pressable
                      onPress={() => router.push({ pathname: '/plan/[id]', params: { id: p.id } })}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.title}, ${CAT[p.cat]?.name ?? p.cat}${p.end !== p.start ? `, ${fmtRange(p.start, p.end)}` : ''}. Edit`}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: CAT[p.cat]?.color ?? C.mut }} />
                      <T w={600} s={13} style={{ flexShrink: 1 }}>
                        {p.title}
                      </T>
                      {p.end !== p.start ? (
                        <T s={11} c={C.mut}>
                          {fmtRange(p.start, p.end)}
                        </T>
                      ) : null}
                    </Pressable>
                    <Pressable
                      onPress={() => removePlan(p)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${p.title}`}
                      hitSlop={4}
                      style={({ pressed }) => [{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, pressed && { backgroundColor: C.s3 }]}
                    >
                      <Feather name="x" size={16} color={C.mut} />
                    </Pressable>
                  </View>
                  {p.end === d ? (
                    <View style={{ paddingLeft: 16 }}>
                      <PlanOutcome p={p} />
                    </View>
                  ) : null}
                </View>
              ))}
              {po.length ? (
                <T s={12} c={C.mut}>
                  {plural(po.length, 'post')} ({po.filter((p) => p.status === 'Posted').length} posted)
                </T>
              ) : null}
              {j?.text ? (
                <T s={12} c={C.mut} numberOfLines={2}>
                  “{j.text}”
                </T>
              ) : null}
              {!ps.length && !po.length && !j?.text ? (
                <T s={13} c={C.mut}>
                  Nothing planned
                </T>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function WeekSheet() {
  useStore();
  const params = useLocalSearchParams<{ w: string; from?: string; to?: string }>();
  const [w, setW] = useState(clampWeek(Number(params.w) || 1));
  const days = weekDays(w);
  const t = todayS();
  const info = S.meta.weeks[String(w)] || {};
  const [focus, setFocus] = useState(info.focus || '');
  const [notes, setNotes] = useState(info.notes || '');
  // The range from the board only applies to the week it was opened on.
  const opened = useRef(w);

  useEffect(() => {
    const i = S.meta.weeks[String(w)] || {};
    setFocus(i.focus || '');
    setNotes(i.notes || '');
    AccessibilityInfo.announceForAccessibility(`Week ${w}, ${fmtRange(weekDays(w)[0], weekDays(w)[6])}`);
  }, [w]);

  return (
    <ModalScreen
      title={fmtRange(days[0], days[6]) + `, ${pd(days[6]).getFullYear()}`}
      right={
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconBtn name="chevron-left" label="Previous week" disabled={w <= 1} onPress={() => setW(w - 1)} />
          <IconBtn name="chevron-right" label="Next week" disabled={w >= WEEKS} onPress={() => setW(w + 1)} />
        </View>
      }
    >
      <T w={600} s={12} c={C.mut}>
        Week {w}
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
      <QuickAdd w={w} days={days} from={w === opened.current ? params.from : undefined} to={w === opened.current ? params.to : undefined} />
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

const g = StyleSheet.create({
  days: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, height: 44, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
