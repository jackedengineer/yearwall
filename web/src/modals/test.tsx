// Web version of src/app/test/[id].tsx (ported from the phone app).
import { router, useLocalSearchParams } from '@web/lib/router';
import { useState } from 'react';
import { View } from '@web/lib/rn';
import { Btn, Field, Label, ModalScreen, Pills } from '@web/ui';
import { S, uid } from '@core/data/state';
import { actions } from '@core/data/store';
import type { Test } from '@core/data/types';

const num = (v: string) => {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const str = (n: number | null) => (n == null ? '' : String(n));

export default function TestSheet() {
  const { id, cid } = useLocalSearchParams<{ id: string; cid: string }>();
  const c = S.meta.chapters.find((x) => x.id === cid);
  const existing = c?.tests.find((x) => x.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [unit, setUnit] = useState(existing?.unit ?? 'min');
  const [better, setBetter] = useState<Test['better']>(existing?.better ?? 'higher');
  const [baseline, setBaseline] = useState(str(existing?.baseline ?? null));
  const [latest, setLatest] = useState(str(existing?.latest ?? null));
  const [target, setTarget] = useState(str(existing?.target ?? null));
  if (!c) return <ModalScreen title="Test not found">{null}</ModalScreen>;

  const save = () => {
    if (!name.trim()) return;
    actions.saveTest(c.id, { id: existing?.id ?? uid('t'), name: name.trim(), unit: unit.trim(), better, baseline: num(baseline), latest: num(latest), target: num(target) });
    router.back();
  };

  return (
    <ModalScreen title={existing ? 'Finish-line test' : 'New test'}>
      <Field label="Test" value={name} onChangeText={setName} placeholder="e.g. Hold a handstand" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Unit" value={unit} onChangeText={setUnit} autoCapitalize="none" />
        </View>
        <View style={{ flex: 1 }}>
          <Label>Better when</Label>
          <Pills options={['higher', 'lower'] as Test['better'][]} value={better} onChange={setBetter} labels={{ higher: 'Higher', lower: 'Lower' }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Day 0" value={baseline} onChangeText={setBaseline} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Latest" value={latest} onChangeText={setLatest} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Target" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Save test" style={{ flex: 1 }} onPress={save} disabled={!name.trim()} />
        {existing ? (
          <Btn
            label="Delete"
            kind="danger"
            onPress={() => {
              actions.deleteTest(c.id, existing.id);
              router.back();
            }}
          />
        ) : null}
      </View>
    </ModalScreen>
  );
}
