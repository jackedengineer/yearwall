// Web version of src/app/plan/[id].tsx (ported from the phone app).
import { router, useLocalSearchParams } from '@web/lib/router';
import { useState } from 'react';
import { Pressable, View } from '@web/lib/rn';
import { Btn, Chip, Chips, DateField, Field, Label, ModalScreen, T } from '@web/ui';
import { CATS } from '@core/constants';
import { S } from '@core/data/state';
import { actions } from '@core/data/store';
import type { Plan } from '@core/data/types';
import { C } from '@web/lib/theme';

export default function PlanSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = S.meta.plans.find((p) => p.id === id);
  const [p, setP] = useState<Plan | null>(existing ? { ...existing } : null);
  if (!p) return <ModalScreen title="Plan not found">{null}</ModalScreen>;
  const set = (patch: Partial<Plan>) => setP({ ...p, ...patch });

  return (
    <ModalScreen title="Edit plan">
      <Field label="Plan" value={p.title} onChangeText={(v) => set({ title: v })} />
      <DateField label="From" value={p.start} onChange={(v) => v && set({ start: v })} />
      <DateField label="To" value={p.end} onChange={(v) => v && set({ end: v })} />
      <View>
        <Label>Category</Label>
        <Chips>
          {CATS.map((c) => (
            <Chip key={c.id} label={c.name} dot={c.color} on={p.cat === c.id} onPress={() => set({ cat: c.id })} />
          ))}
        </Chips>
      </View>
      <Pressable
        onPress={() => set({ milestone: !p.milestone })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!p.milestone }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: p.milestone ? C.lit : '#4A4642', backgroundColor: p.milestone ? C.lit : 'transparent' }} />
        <T>Count down to it on Today</T>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn
          label="Save plan"
          style={{ flex: 1 }}
          disabled={!p.title.trim()}
          onPress={() => {
            actions.savePlan({ ...p, title: p.title.trim() });
            router.back();
          }}
        />
        <Btn
          label="Delete"
          kind="danger"
          onPress={() => {
            actions.deletePlan(p.id);
            router.back();
          }}
        />
      </View>
    </ModalScreen>
  );
}
