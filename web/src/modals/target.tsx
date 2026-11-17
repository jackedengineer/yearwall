// Web version of src/app/target.tsx (ported from the phone app).
import { router } from '@web/lib/router';
import { useState } from 'react';
import { Btn, Field, ModalScreen } from '@web/ui';
import { S } from '@core/data/state';
import { actions } from '@core/data/store';

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
