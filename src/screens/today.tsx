import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, type TextInputInstance, View } from 'react-native';
import { onJournalFocus } from '@/components/habit-actions';
import { HabitCards } from '@/components/habit-card';
import { PlansToAnswer } from '@/components/plan-outcome';
import { Banner, Card, Chip, Empty, Field, IconBtn, Screen, Section, Sep, T } from '@/components/ui';
import { CAT, STATUS_COLOR } from '@/constants';
import { commit, S, UI } from '@/data/state';
import { actions } from '@/data/store';
import { useStore } from '@/hooks/use-store';
import { C } from '@/theme';
import { addD, diff, fmt, fmtRange, plural, todayS, weekOf, clampWeek, WEEKS, YEAR_START } from '@/utils/dates';
import { chapterAt, doneOn, habits, isActive, journalOn, nextChapter, nextMilestone, phaseAt, plansOn } from '@/utils/logic';

const tap = () => Haptics.selectionAsync().catch(() => {});

function ChapterCard({ d }: { d: string }) {
  const c = chapterAt(d);
  const ms = nextMilestone(d);
  const chip = ms ? (
    <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amberLine }}>
      <T s={12} c={C.amberTx}>
        {ms.title} in {plural(diff(d, ms.start), 'day')}
      </T>
    </View>
  ) : null;
  if (!c) {
    const nx = nextChapter(d);
    if (!nx) return null;
    return (
      <Card style={{ padding: 16, gap: 8 }} onPress={() => router.navigate('/chapter')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <View>
            <T w={600} s={12} c={C.mut}>
              Next: Chapter {nx.n}
            </T>
            <T w={700} s={20}>
              {nx.name}
            </T>
          </View>
          {chip}
        </View>
        <T s={12} c={C.mut}>
          Starts {fmt(nx.start, { wd: true })}, in {plural(diff(d, nx.start), 'day')}.
        </T>
      </Card>
    );
  }
  const ph = phaseAt(c, d);
  const w = clampWeek(weekOf(d));
  const focus = S.meta.weeks[String(w)]?.focus;
  return (
    <Card style={{ padding: 16, gap: 12 }} onPress={() => router.navigate('/chapter')}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <View>
          <T w={600} s={12} c={C.mut}>
            Chapter {c.n}
            {ph ? `, ${ph.name} phase` : ''}
          </T>
          <T w={700} s={20}>
            {c.name}
          </T>
        </View>
        {chip}
      </View>
      {c.phases.length ? (
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {c.phases.map((p, i) => {
            const len = diff(p.start, p.end) + 1;
            const frac = d > p.end ? 1 : d < p.start ? 0 : (diff(p.start, d) + 1) / len;
            return (
              <View key={i} style={{ flex: len, height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(frac * 100)}%` as `${number}%`, height: '100%', backgroundColor: C.lit }} />
              </View>
            );
          })}
        </View>
      ) : null}
      <T s={12} c={C.mut}>
        Week {w} of {WEEKS}
        {focus ? `, ${focus}` : ''}. {plural(Math.max(0, diff(d, c.end)), 'day')} left in this chapter.
      </T>
    </Card>
  );
}

function Journal({ d }: { d: string }) {
  const j = journalOn(d) || {};
  const [text, setText] = useState(j.text || '');
  const [feyn, setFeyn] = useState(j.feynman || '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ text?: string; feynman?: string }>({});
  const input = useRef<TextInputInstance>(null);
  // The Nightly log ring opens this field.
  useEffect(() => onJournalFocus((day) => day === d && input.current?.focus()), [d]);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (Object.keys(pending.current).length) {
      actions.saveJournal(d, pending.current);
      pending.current = {};
    }
  };
  useEffect(() => {
    const cur = journalOn(d) || {};
    setText(cur.text || '');
    setFeyn(cur.feynman || '');
    return flush; // save on day change / unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  const change = (patch: { text?: string; feynman?: string }) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };
  const t = todayS();
  const future = d > t;
  return (
    <Card style={{ padding: 14, gap: 12 }}>
      <Field
        ref={input}
        label="What happened, what surprised you, how you feel"
        value={text}
        onChangeText={(v) => {
          setText(v);
          change({ text: v });
        }}
        onBlur={flush}
        placeholder="Type, or tap the mic on your keyboard to speak"
        multiline
        editable={!future}
      />
      <Field
        label="Feynman note: explain one thing you learned, simply"
        value={feyn}
        onChangeText={(v) => {
          setFeyn(v);
          change({ feynman: v });
        }}
        onBlur={flush}
        placeholder="e.g. Why slow breathing calms you down"
        multiline
        editable={!future}
      />
      <View>
        <T w={600} s={12} c={C.mut} style={{ marginBottom: 6 }}>
          Energy today
        </T>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[1, 2, 3, 4, 5].map((v) => {
            const on = j.energy === v;
            return (
              <Pressable
                key={v}
                disabled={future}
                onPress={() => {
                  tap();
                  actions.saveJournal(d, { energy: on ? null : v });
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Energy ${v}`}
                style={{ flex: 1, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? C.lit : C.line3, backgroundColor: on ? C.lit : C.s3 }}
              >
                <T w={600} c={on ? C.bg : C.tx2}>
                  {v}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

export function Today() {
  useStore();
  const t = todayS();
  if (!UI.day) UI.day = t;
  const d = UI.day;
  const setDay = (v: string) => {
    UI.day = v < YEAR_START ? YEAR_START : v > t ? t : v;
    commit();
  };
  const day0 = S.meta.settings.day0;
  const n = diff(day0, d);
  const big = n >= 0 ? `Day ${n}` : n === -1 ? 'Day 0 is tomorrow' : `Day 0 in ${-n} days`;
  const label = (d === t ? 'Today, ' : d === addD(t, -1) ? 'Yesterday, ' : '') + fmt(d, { wd: true });
  const act = habits().filter((h) => isActive(h, d));
  const doneN = act.filter((h) => doneOn(h, d)).length;
  const plans = plansOn(d);
  const posts = S.posts.filter((p) => p.date === d);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <IconBtn name="chevron-left" label="Previous day" size={32} iconSize={16} disabled={d <= YEAR_START} onPress={() => setDay(addD(d, -1))} />
            <T w={600} s={13} c={C.mut} style={{ paddingHorizontal: 4 }}>
              {label}
            </T>
            <IconBtn name="chevron-right" label="Next day" size={32} iconSize={16} disabled={d >= t} onPress={() => setDay(addD(d, 1))} />
          </View>
          <T w={700} s={30} style={{ letterSpacing: -0.6, lineHeight: 38 }}>
            {big}
          </T>
        </View>
        <IconBtn name="settings" label="Settings" onPress={() => router.push('/settings')} />
      </View>

      {d !== t ? <Banner onPress={() => setDay(t)}>{`You're editing ${fmt(d, { wd: true })}. Tap to go back to today.`}</Banner> : null}

      <ChapterCard d={d} />

      <Section left={d === t ? 'Habits today' : 'Habits this day'} right={act.length ? `${doneN} of ${act.length} done` : undefined} />
      {act.length ? (
        <HabitCards d={d} />
      ) : (
        <Empty>
          {d < day0
            ? `Your habits start on Day 0, ${fmt(day0, { wd: true })}.`
            : plans.some((p) => p.milestone)
              ? 'Habits are paused today. Be where you are.'
              : 'No habits are active today. Add one in settings.'}
        </Empty>
      )}

      {d === t ? <PlansToAnswer /> : null}

      <Section left="Plans and posts" right={plans.length + posts.length ? String(plans.length + posts.length) : undefined} />
      {plans.length + posts.length ? (
        <Card>
          {plans.map((p, i) => (
            <View key={p.id}>
              {i > 0 ? <Sep /> : null}
              <Pressable style={row.item} onPress={() => router.push({ pathname: '/plan/[id]', params: { id: p.id } })}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: CAT[p.cat]?.color ?? C.mut }} />
                <T s={14} style={{ flex: 1 }}>
                  {p.title}
                </T>
                <T s={12} c={C.mut}>
                  {p.end !== p.start ? fmtRange(p.start, p.end) : 'Plan'}
                </T>
              </Pressable>
            </View>
          ))}
          {posts.map((p, i) => (
            <View key={p.id}>
              {i > 0 || plans.length ? <Sep /> : null}
              <Pressable style={row.item} onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } })}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_COLOR[p.status] ?? C.mid }} />
                <T s={14} style={{ flex: 1 }}>
                  {p.title}
                </T>
                <Chip label={p.bucket} />
              </Pressable>
            </View>
          ))}
        </Card>
      ) : (
        <Empty>Nothing planned. Add plans from a week on the Year board, and posts from Content.</Empty>
      )}

      <Section left={d === t ? "Tonight's log" : 'Log for this day'} />
      <Journal key={d} d={d} />
    </Screen>
  );
}

const row = {
  habit: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingVertical: 12, paddingLeft: 14, paddingRight: 12 },
  main: { flex: 1, minWidth: 0, gap: 6 },
  meta: { flexDirection: 'row' as const, gap: 10, flexWrap: 'wrap' as const },
  step: { minWidth: 50, height: 44, borderRadius: 12, backgroundColor: C.s4, borderWidth: 1, borderColor: C.line3, alignItems: 'center' as const, justifyContent: 'center' as const },
  minus: { minWidth: 40 },
  check: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: '#4A4642', alignItems: 'center' as const, justifyContent: 'center' as const },
  checkOn: { backgroundColor: C.lit, borderColor: C.lit },
  item: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
};
