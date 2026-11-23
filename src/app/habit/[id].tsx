import { router, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { deleteHabit } from '@/components/habit-actions';
import { Banner, Btn, Card, DateField, Field, IconBtn, Label, ModalScreen, Pills, T } from '@/components/ui';
import { S, uid } from '@/data/state';
import { actions } from '@/data/store';
import type { Habit, HabitColor } from '@/data/types';
import { C, HABIT_COLOR_IDS, HABIT_COLORS } from '@/theme';
import { addD, todayS, YEAR_START } from '@/utils/dates';
import { habitColorId, nextHabitColor } from '@/utils/progress';

function ColorPicker({ value, onChange }: { value: HabitColor; onChange: (c: HabitColor) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Colour" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {HABIT_COLOR_IDS.map((c) => {
        const on = c === value;
        return (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={HABIT_COLORS[c].name}
            onPress={() => onChange(c)}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? C.tx : 'transparent' }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: HABIT_COLORS[c].fill, alignItems: 'center', justifyContent: 'center' }}>
              {on ? <Feather name="check" size={18} color={C.bg} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function HabitSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = S.meta.habits.find((h) => h.id === id);
  const t = todayS();
  const start = t < YEAR_START ? YEAR_START : t;
  const [h, setH] = useState<Habit>(() =>
    existing
      ? JSON.parse(JSON.stringify(existing))
      : { id: uid('h'), name: '', type: 'check', auto: null, step: 5, daysPerWeek: 7, targets: [{ from: start, value: 1 }], activeFrom: start, activeTo: null, pauses: [], color: nextHabitColor() },
  );
  // Habits saved before colours existed show their default colour; saving keeps it.
  const color = h.color ?? (existing ? habitColorId(existing) : nextHabitColor());
  const set = (patch: Partial<Habit>) => setH({ ...h, ...patch });
  const targets = h.targets.slice().sort((a, b) => (a.from < b.from ? -1 : 1));
  const setTarget = (i: number, patch: Partial<Habit['targets'][number]>) => set({ targets: targets.map((x, k) => (k === i ? { ...x, ...patch } : x)) });

  const save = () => {
    if (!h.name.trim()) return;
    const clean: Habit = { ...h, color, name: h.name.trim(), targets: h.type === 'check' ? [{ from: targets[0]?.from ?? h.activeFrom, value: 1 }] : targets };
    actions.saveHabit(clean);
    router.back();
  };

  return (
    <ModalScreen title={existing ? 'Edit habit' : 'New habit'}>
      <Field label="Habit" value={h.name} onChangeText={(v) => set({ name: v })} placeholder="e.g. Practice handstands" />
      <View>
        <Label>Colour</Label>
        <ColorPicker value={color} onChange={(c) => set({ color: c })} />
      </View>
      {h.auto === 'journal' ? (
        <Banner>This habit ticks itself when you write a log on Today.</Banner>
      ) : (
        <View>
          <Label>Type</Label>
          <Pills
            options={['check', 'minutes'] as Habit['type'][]}
            value={h.type}
            labels={{ check: 'Check', minutes: 'Minutes' }}
            onChange={(v) => set({ type: v, targets: v === 'minutes' && targets.every((x) => x.value <= 1) ? targets.map((x) => ({ ...x, value: 20 })) : targets })}
          />
        </View>
      )}

      {h.type === 'minutes' ? (
        <View style={{ gap: 8 }}>
          <Label>Daily target in minutes, from each date on</Label>
          {targets.map((x, i) => (
            <Card key={i} style={{ padding: 12, gap: 8, backgroundColor: 'transparent' }}>
              <DateField label={i === 0 ? 'From the start' : 'From'} value={x.from} onChange={(v) => v && setTarget(i, { from: v })} />
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <Field label="Minutes a day" value={String(x.value)} keyboardType="number-pad" onChangeText={(v) => setTarget(i, { value: Number(v) || 0 })} />
                </View>
                <IconBtn name="x" label="Remove this step" disabled={targets.length < 2} onPress={() => set({ targets: targets.filter((_, k) => k !== i) })} />
              </View>
            </Card>
          ))}
          <Btn
            label="Add a step up"
            kind="ghost"
            onPress={() => {
              const last = targets[targets.length - 1];
              set({ targets: [...targets, { from: addD(last.from > t ? last.from : t, 7), value: last.value }] });
            }}
          />
          <Field label="Minutes per tap on Today" value={String(h.step)} keyboardType="number-pad" onChangeText={(v) => set({ step: Math.max(1, Number(v) || 1) })} />
        </View>
      ) : null}

      <View>
        <Label>Days a week</Label>
        <Pills options={[1, 2, 3, 4, 5, 6, 7]} value={h.daysPerWeek || 7} onChange={(v) => set({ daysPerWeek: v })} />
        <T s={12} c={C.mut} style={{ marginTop: 6 }}>
          {(h.daysPerWeek || 7) >= 7 ? 'Every day. Streaks count days.' : `Any ${h.daysPerWeek} days each week. Streaks count weeks.`}
        </T>
      </View>
      <DateField label="Starts" value={h.activeFrom} onChange={(v) => v && set({ activeFrom: v })} />
      <DateField label="Ends (optional, leave empty to keep going)" value={h.activeTo} optional onChange={(v) => set({ activeTo: v })} />

      <View style={{ gap: 8 }}>
        <Label>Pauses (these days never break a streak)</Label>
        {h.pauses.map((p, i) => (
          <Card key={i} style={{ padding: 12, gap: 8, backgroundColor: 'transparent' }}>
            <DateField label="From" value={p.from} onChange={(v) => v && set({ pauses: h.pauses.map((x, k) => (k === i ? { ...x, from: v } : x)) })} />
            <DateField label="To" value={p.to} onChange={(v) => v && set({ pauses: h.pauses.map((x, k) => (k === i ? { ...x, to: v } : x)) })} />
            <Btn label="Remove pause" kind="ghost" onPress={() => set({ pauses: h.pauses.filter((_, k) => k !== i) })} />
          </Card>
        ))}
        <Btn label="Add a pause" kind="ghost" onPress={() => set({ pauses: [...h.pauses, { from: start, to: addD(start, 6) }] })} />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Save habit" style={{ flex: 1 }} onPress={save} disabled={!h.name.trim()} />
        {existing ? (
          <Btn label="Delete" kind="danger" onPress={() => void deleteHabit(existing).then((gone) => gone && router.back())} />
        ) : null}
      </View>
    </ModalScreen>
  );
}
