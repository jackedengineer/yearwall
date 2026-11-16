import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Btn, Card, Chip, Chips, Field, IconBtn, ModalScreen, T } from '@/components/ui';
import { CAT, CATS } from '@/constants';
import { commit, S, UI } from '@/data/state';
import { actions } from '@/data/store';
import type { CatId } from '@/data/types';
import { useStore } from '@/hooks/use-store';
import { C } from '@/theme';
import { clampWeek, DOW, dowI, fmt, fmtRange, pd, plural, todayS, weekDays, weekOf, WEEKS } from '@/utils/dates';
import { doneOn, habits, isActive, journalOn, plansOn, targetOn, valueOn } from '@/utils/logic';

export default function WeekSheet() {
  useStore();
  const params = useLocalSearchParams<{ w: string }>();
  const [w, setW] = useState(clampWeek(Number(params.w) || 1));
  const days = weekDays(w);
  const t = todayS();
  const info = S.meta.weeks[String(w)] || {};
  const [focus, setFocus] = useState(info.focus || '');
  const [notes, setNotes] = useState(info.notes || '');
  const [title, setTitle] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [cat, setCat] = useState<CatId>('work');

  useEffect(() => {
    const i = S.meta.weeks[String(w)] || {};
    setFocus(i.focus || '');
    setNotes(i.notes || '');
    setSel([]);
  }, [w]);

  const hs = habits().filter((h) => days.some((d) => isActive(h, d)));
  const posts = S.posts.filter((p) => days.includes(p.date));
  const posted = posts.filter((p) => p.status === 'Posted').length;
  const inRange = (d: string) => sel.length === 2 && d > sel[0] && d < sel[1];
  const when = sel.length === 0 ? 'Pick a day, or two days for a range' : sel.length === 1 ? fmt(sel[0], { wd: true }) : fmtRange(sel[0], sel[1]);

  const pickDay = (d: string) => {
    if (sel.length === 0 || sel.length === 2) setSel([d]);
    else if (sel[0] === d) setSel([]);
    else setSel([sel[0], d].sort());
  };
  const addPlan = () => {
    const tt = title.trim();
    if (!tt) return;
    const range = sel.length ? sel : [days.includes(t) ? t : days[0]];
    actions.addPlan(tt, range[0], range[1] || range[0], cat);
    setTitle('');
    setSel([]);
  };

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
      <T w={600} s={12} c={C.mut} style={{ marginTop: -10 }}>
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

      {hs.length ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <T w={600} s={11} c={C.mut} style={{ flex: 1.6 }}>
              Habits
            </T>
            {DOW.map((x, i) => (
              <T key={i} w={600} s={11} c={C.mut} style={{ flex: 1, textAlign: 'center' }}>
                {x[0]}
              </T>
            ))}
            <View style={{ width: 30 }} />
          </View>
          {hs.map((h) => {
            const act = days.filter((d) => isActive(h, d));
            const need = Math.min(h.daysPerWeek || 7, act.length);
            const n = act.filter((d) => d <= t && doneOn(h, d)).length;
            return (
              <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <T w={600} s={13} numberOfLines={1} style={{ flex: 1.6 }}>
                  {h.name}
                </T>
                {days.map((d) => {
                  const a = isActive(h, d);
                  const v = valueOn(h, d);
                  const tg = targetOn(h, d);
                  const dis = !a || d > t || h.auto === 'journal';
                  const bg = !a ? '#0B0A09' : v >= tg ? C.lit : v > 0 ? C.mid : '#0B0A09';
                  return (
                    <View key={d} style={{ flex: 1 }}>
                      <Pressable
                        disabled={dis}
                        onPress={() => actions.setValue(h, d, doneOn(h, d) ? 0 : tg)}
                        accessibilityLabel={`${h.name}, ${fmt(d, { wd: true })}, ${!a ? 'not scheduled' : v >= tg ? 'done' : 'not done'}`}
                        style={{ aspectRatio: 1, borderRadius: 7, borderWidth: d === t ? 1.5 : 1, borderColor: d === t ? C.lit : v >= tg && a ? C.lit : C.line3, backgroundColor: bg, opacity: a ? 1 : 0.25 }}
                      />
                    </View>
                  );
                })}
                <T s={12} c={C.mut} style={{ width: 30, textAlign: 'right' }}>
                  {n}/{need}
                </T>
              </View>
            );
          })}
        </View>
      ) : (
        <T s={13} c={C.mut}>
          No habits are active this week.
        </T>
      )}

      <Card style={{ padding: 14, gap: 10, backgroundColor: 'transparent' }}>
        <Field label="Add a plan" value={title} onChangeText={setTitle} placeholder="e.g. Client call, mini-retreat day" returnKeyType="done" onSubmitEditing={addPlan} />
        <T s={12} c={C.mut}>
          When: <T s={12} w={700}>{when}</T>
        </T>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {days.map((d, i) => {
            const on = sel.includes(d);
            const mid = inRange(d);
            return (
              <Pressable
                key={d}
                onPress={() => pickDay(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{ flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? C.lit : mid ? '#4A4642' : '#2E2B28', backgroundColor: on ? C.lit : mid ? '#4A4642' : C.s3 }}
              >
                <T w={600} s={11} c={on ? C.bg : C.tx2}>
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
        <Btn label="Add plan" onPress={addPlan} disabled={!title.trim()} />
      </Card>

      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <T w={600} s={13} c={C.mut}>
            Days
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
                accessibilityLabel={`Open ${fmt(d, { wd: true })} in Today`}
                style={{ width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: today ? C.lit : C.s3, opacity: d > t ? 0.6 : 1 }}
              >
                <T w={600} s={9} c={today ? '#4A4642' : C.mut} style={{ lineHeight: 11 }}>
                  {DOW[dowI(d)]}
                </T>
                <T w={700} s={14} c={today ? C.bg : C.tx} style={{ lineHeight: 17 }}>
                  {pd(d).getDate()}
                </T>
              </Pressable>
              <View style={{ flex: 1, gap: 4, paddingTop: 2 }}>
                {ps.map((p) => (
                  <Pressable key={p.id} onPress={() => router.push({ pathname: '/plan/[id]', params: { id: p.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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

      <Field
        label="Notes"
        value={notes}
        onChangeText={(v) => {
          setNotes(v);
          actions.saveWeek(w, { notes: v }, true);
        }}
        placeholder="Wins, misses, reminders for this week"
        multiline
      />
      <Btn label="Share this week as an image" kind="ghost" icon="share" onPress={() => router.push({ pathname: '/share', params: { kind: 'week', w: String(w) } })} />
    </ModalScreen>
  );
}
