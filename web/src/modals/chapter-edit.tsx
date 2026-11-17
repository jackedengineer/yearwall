// Web version of src/app/chapter-edit/[id].tsx (ported from the phone app).
import { router, useLocalSearchParams } from '@web/lib/router';
import { useState } from 'react';
import { Alert, View } from '@web/lib/rn';
import { Btn, Card, DateField, Field, IconBtn, Label, ModalScreen } from '@web/ui';
import { S, UI, uid } from '@core/data/state';
import { actions } from '@core/data/store';
import type { Chapter, Phase } from '@core/data/types';
import { addD, todayS } from '@core/utils/dates';

export default function ChapterEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = S.meta.chapters.find((c) => c.id === id);
  const [c, setC] = useState<Chapter>(() =>
    existing
      ? JSON.parse(JSON.stringify(existing))
      : { id: uid('c'), n: S.meta.chapters.length + 1, name: '', skill: '', start: todayS(), end: addD(todayS(), 41), tests: [], phases: [] },
  );
  const set = (patch: Partial<Chapter>) => setC({ ...c, ...patch });
  const setPhase = (i: number, patch: Partial<Phase>) => set({ phases: c.phases.map((p, k) => (k === i ? { ...p, ...patch } : p)) });

  const save = () => {
    if (!c.name.trim()) return;
    actions.saveChapter({ ...c, name: c.name.trim(), phases: c.phases.filter((p) => p.name.trim()) });
    UI.chapterId = c.id;
    router.back();
  };

  return (
    <ModalScreen title={existing ? 'Edit chapter' : 'New chapter'}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ width: 80 }}>
          <Field label="Number" value={String(c.n)} onChangeText={(v) => set({ n: Number(v) || c.n })} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Name" value={c.name} onChangeText={(v) => set({ name: v })} placeholder="e.g. The Stage" />
        </View>
      </View>
      <Field label="Skill" value={c.skill} onChangeText={(v) => set({ skill: v })} placeholder="What you're learning" />
      <DateField label="Starts" value={c.start} onChange={(v) => v && set({ start: v })} />
      <DateField label="Ends" value={c.end} onChange={(v) => v && set({ end: v })} />

      <View style={{ gap: 8 }}>
        <Label>Phases</Label>
        {c.phases.map((p, i) => (
          <Card key={i} style={{ padding: 12, gap: 10, backgroundColor: 'transparent' }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Field value={p.name} onChangeText={(v) => setPhase(i, { name: v })} placeholder="Phase name" accessibilityLabel="Phase name" />
              </View>
              <IconBtn name="x" label="Remove phase" onPress={() => set({ phases: c.phases.filter((_, k) => k !== i) })} />
            </View>
            <DateField label="From" value={p.start} onChange={(v) => v && setPhase(i, { start: v })} />
            <DateField label="To" value={p.end} onChange={(v) => v && setPhase(i, { end: v })} />
            <Field value={p.note} onChangeText={(v) => setPhase(i, { note: v })} placeholder="What to focus on" multiline accessibilityLabel="Phase focus" />
          </Card>
        ))}
        <Btn
          label="Add a phase"
          kind="ghost"
          onPress={() => {
            const last = c.phases[c.phases.length - 1];
            const s = last ? addD(last.end, 1) : c.start;
            set({ phases: [...c.phases, { name: '', start: s, end: addD(s, 6), note: '' }] });
          }}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Save chapter" style={{ flex: 1 }} onPress={save} disabled={!c.name.trim()} />
        {existing ? (
          <Btn
            label="Delete"
            kind="danger"
            onPress={() =>
              Alert.alert('Delete this chapter?', 'Its phases and tests are deleted too.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    actions.deleteChapter(existing.id);
                    UI.chapterId = '';
                    router.back();
                  },
                },
              ])
            }
          />
        ) : null}
      </View>
    </ModalScreen>
  );
}
