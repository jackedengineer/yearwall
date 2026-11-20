import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { PlanOutcome } from '@/components/plan-outcome';
import { toast } from '@/components/toast';
import { Btn, Chip, Chips, DateField, Field, Label, ModalScreen, T } from '@/components/ui';
import { CATS } from '@/constants';
import { S } from '@/data/state';
import { useStore } from '@/hooks/use-store';
import { actions } from '@/data/store';
import type { Plan } from '@/data/types';
import { C } from '@/theme';
import { todayS } from '@/utils/dates';

export default function PlanSheet() {
  useStore();
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = S.meta.plans.find((p) => p.id === id);
  const [p, setP] = useState<Plan | null>(existing ? { ...existing } : null);
  if (!p) return <ModalScreen title="Plan not found">{null}</ModalScreen>;
  const set = (patch: Partial<Plan>) => setP({ ...p, ...patch });
  // "Did it happen?" saves straight away, so take the answer from the live plan when saving the rest.
  const live = S.meta.plans.find((x) => x.id === p.id);

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
      {live && (live.outcome || (live.end || live.start) < todayS()) ? (
        <View style={{ gap: 6 }}>
          <Label>Did it happen?</Label>
          <PlanOutcome p={live} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn
          label="Save plan"
          style={{ flex: 1 }}
          disabled={!p.title.trim()}
          onPress={() => {
            actions.savePlan({ ...p, title: p.title.trim(), outcome: live ? live.outcome : p.outcome });
            router.back();
          }}
        />
        <Btn
          label="Delete"
          kind="danger"
          onPress={() => {
            const gone = actions.deletePlan(p.id);
            if (gone) toast({ message: `Removed "${gone.title}".`, undo: () => actions.savePlan(gone) });
            router.back();
          }}
        />
      </View>
    </ModalScreen>
  );
}
