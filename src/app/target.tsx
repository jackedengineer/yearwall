import { router } from 'expo-router';
import { useState } from 'react';
import { Btn, Field, ModalScreen } from '@/components/ui';
import { S } from '@/data/state';
import { actions } from '@/data/store';

export default function TargetSheet() {
  const [v, setV] = useState(S.meta.settings.monthlyTarget ? String(S.meta.settings.monthlyTarget) : '');
  return (
    <ModalScreen title="Monthly income target">
      <Field label={`Target per month (${S.meta.settings.currency})`} value={v} onChangeText={setV} keyboardType="number-pad" autoFocus placeholder="0" />
      <Btn
        label="Save target"
        onPress={() => {
          actions.saveSettings({ monthlyTarget: Math.max(0, Number(v.replace(/,/g, '')) || 0) });
          router.back();
        }}
      />
    </ModalScreen>
  );
}
