// Web version of src/app/habit/[id].tsx (ported from the phone app).
import { router, useLocalSearchParams } from '@web/lib/router';
import { useState } from 'react';
import { View } from '@web/lib/rn';
import { Banner, Btn, Card, DateField, Field, IconBtn, Label, ModalScreen, Pills, T } from '@web/ui';
import { C } from '@web/lib/theme';
import { S, uid } from '@core/data/state';
import { actions } from '@core/data/store';
import type { Habit } from '@core/data/types';
import { addD, todayS, YEAR_START } from '@core/utils/dates';
import { HABIT_COLORS, HABIT_COLOR_IDS } from '@core/theme';
import { habitColorId, nextHabitColor } from '@core/utils/progress';
import { deleteHabit } from '@web/components/habit-actions';
import type { HabitColor } from '@core/data/types';

/** Six swatches as a radio group: arrow keys move between them. */
function ColorPicker({ value, onChange }: { value: HabitColor; onChange: (c: HabitColor) => void }) {
  const move = (dir: number) => {
    const i = HABIT_COLOR_IDS.indexOf(value);
    const next = HABIT_COLOR_IDS[(i + dir + HABIT_COLOR_IDS.length) % HABIT_COLOR_IDS.length];
    onChange(next);
    requestAnimationFrame(() => document.getElementById(`swatch-${next}`)?.focus());
  };
  return (
    <div
      className="swatches"
      role="radiogroup"
      aria-label="Colour"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {HABIT_COLOR_IDS.map((c) => (
        <button
          key={c}
          id={`swatch-${c}`}
          type="button"
          role="radio"
          aria-checked={c === value}
          aria-label={HABIT_COLORS[c].name}
          tabIndex={c === value ? 0 : -1}
          className="swatch"
          style={{ background: HABIT_COLORS[c].fill }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
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
      <Field label="Habit" value={h.name} onChangeText={(v) => set({ name: v })} placeholder="e.g. Practice handstands" autoFocus={!existing} />
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
          <Field label="Minutes per click on Today" value={String(h.step)} keyboardType="number-pad" onChangeText={(v) => set({ step: Math.max(1, Number(v) || 1) })} />
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
