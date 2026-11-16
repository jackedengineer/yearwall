import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Btn, Chip, Chips, DateField, Field, Label, ModalScreen } from '@/components/ui';
import { SOURCES } from '@/constants';
import { S, UI, uid } from '@/data/state';
import { actions } from '@/data/store';
import type { SourceId } from '@/data/types';
import { monKey, todayS, YEAR_START } from '@/utils/dates';

export default function IncomeSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = S.income.find((x) => x.id === id);
  const t = todayS();
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [date, setDate] = useState(existing?.date ?? (t < YEAR_START ? YEAR_START : t));
  const [source, setSource] = useState<SourceId>(existing?.source ?? 'freelance');
  const [note, setNote] = useState(existing?.note ?? '');
  const amt = Number(amount.replace(/,/g, ''));
  const valid = Number.isFinite(amt) && amt > 0;

  const save = () => {
    if (!valid) return;
    actions.saveIncome({ id: existing?.id ?? uid('i'), amount: amt, date, source, note: note.trim() });
    UI.moneyMonth = monKey(date);
    router.back();
  };

  return (
    <ModalScreen title={existing ? 'Edit income' : 'Add income'}>
      <Field label={`Amount (${S.meta.settings.currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" autoFocus={!existing} />
      <DateField label="Date" value={date} onChange={(v) => v && setDate(v)} />
      <View>
        <Label>Source</Label>
        <Chips>
          {SOURCES.map((s) => (
            <Chip key={s.id} label={s.name} dot={s.color} on={source === s.id} onPress={() => setSource(s.id)} />
          ))}
        </Chips>
      </View>
      <Field label="Note" value={note} onChangeText={setNote} placeholder="e.g. Landing page for a client" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label={existing ? 'Save' : 'Add income'} style={{ flex: 1 }} onPress={save} disabled={!valid} />
        {existing ? (
          <Btn
            label="Delete"
            kind="danger"
            onPress={() => {
              actions.deleteIncome(existing.id);
              router.back();
            }}
          />
        ) : null}
      </View>
    </ModalScreen>
  );
}
