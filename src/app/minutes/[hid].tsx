import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Btn, Field, ModalScreen } from '@/components/ui';
import { S } from '@/data/state';
import { actions } from '@/data/store';
import { fmt, isDate, todayS } from '@/utils/dates';
import { targetOn, valueOn } from '@/utils/logic';

export default function MinutesSheet() {
  const { hid, d } = useLocalSearchParams<{ hid: string; d?: string }>();
  const h = S.meta.habits.find((x) => x.id === hid);
  const day = d && isDate(d) ? d : todayS();
  const [v, setV] = useState(h ? String(valueOn(h, day)) : '0');
  if (!h) return <ModalScreen title="Habit not found">{null}</ModalScreen>;
  return (
    <ModalScreen title={`${h.name} minutes`}>
      <Field label={`Minutes on ${fmt(day, { wd: true })} (target ${targetOn(h, day)})`} value={v} onChangeText={setV} keyboardType="number-pad" autoFocus selectTextOnFocus />
      <Btn
        label="Save minutes"
        onPress={() => {
          actions.setValue(h, day, Math.max(0, Math.round(Number(v) || 0)));
          router.back();
        }}
      />
    </ModalScreen>
  );
}
