/**
 * Quarter goals as a checklist (up to 5). Done on the keyboard adds a goal and
 * keeps the field open for the next; the circle ticks it off; × removes it
 * (Undo in the toast). The current quarter is outlined "Now"; past ones say "Done".
 */
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputInstance, View } from 'react-native';
import { S, uid } from '@/data/state';
import { actions } from '@/data/store';
import type { GoalItem, GoalKey } from '@/data/types';
import { C, CONTROL_LINE, font } from '@/theme';
import { fmt, todayS } from '@/utils/dates';
import { goalItems, MAX_GOALS, quarterOf, quarterRange } from '@/utils/progress';
import { toast } from './toast';
import { T } from './ui';

export function GoalCard({ q }: { q: 1 | 2 | 3 | 4 }) {
  const key = `q${q}` as GoalKey;
  const items = goalItems(S.meta.goals[key], key);
  const [draft, setDraft] = useState('');
  const input = useRef<TextInputInstance>(null);
  const t = todayS();
  const range = quarterRange(q);
  const now = quarterOf(t) === q && t >= range.start;
  const past = range.end < t;
  const done = items.filter((i) => i.done).length;
  const save = (next: GoalItem[]) => actions.saveGoalItems(q, next);

  const add = () => {
    const text = draft.trim();
    if (!text || items.length >= MAX_GOALS) return;
    save([...items, { id: uid('g'), text, done: false }]);
    setDraft('');
  };
  const remove = (g: GoalItem) => {
    const at = items.findIndex((x) => x.id === g.id);
    save(items.filter((x) => x.id !== g.id));
    // Undo puts back just this goal, at its place in whatever the list is by then.
    toast({
      message: `Removed "${g.text}".`,
      undo: () => {
        const cur = goalItems(S.meta.goals[key], key);
        if (cur.some((x) => x.id === g.id) || cur.length >= MAX_GOALS) return;
        save([...cur.slice(0, at), g, ...cur.slice(at)]);
      },
    });
  };

  return (
    <View style={[s.card, now && s.now]}>
      <View style={s.head}>
        <T w={700} s={13} accessibilityRole="header" style={{ flexShrink: 1 }}>
          Q{q} goals{' '}
          <T s={11} c={C.mut}>
            {fmt(range.start)} – {fmt(range.end)}
          </T>
        </T>
        {now ? (
          <View style={[s.badge, { backgroundColor: C.lit }]}>
            <T w={700} s={11} c={C.bg}>
              Now
            </T>
          </View>
        ) : past ? (
          <View style={s.badge}>
            <T w={600} s={11} c={C.mut}>
              Done
            </T>
          </View>
        ) : null}
      </View>
      {items.map((g) => (
        <View key={g.id} style={s.row}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: g.done }}
            accessibilityLabel={g.text}
            hitSlop={8}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              save(items.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)));
            }}
            style={[s.tick, g.done && { backgroundColor: C.ok, borderColor: C.ok }]}
          >
            {g.done ? <Feather name="check" size={13} color={C.bg} /> : null}
          </Pressable>
          <T s={14} c={g.done ? C.mut : C.tx} style={[{ flex: 1 }, g.done && { textDecorationLine: 'line-through' }]}>
            {g.text}
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${g.text}`} hitSlop={4} onPress={() => remove(g)} style={({ pressed }) => [s.x, pressed && { backgroundColor: C.s3 }]}>
            <Feather name="x" size={15} color={C.mut} />
          </Pressable>
        </View>
      ))}
      {items.length < MAX_GOALS ? (
        <View style={s.addRow}>
          <TextInput
            ref={input}
            value={draft}
            onChangeText={setDraft}
            placeholder={items.length ? 'Add another goal' : 'Add a goal'}
            placeholderTextColor="#6F6A65"
            accessibilityLabel={`Add a Q${q} goal`}
            maxLength={140}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={add}
            keyboardAppearance="dark"
            selectionColor={C.lit}
            style={[s.field, font(500)]}
          />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !draft.trim() }} disabled={!draft.trim()} onPress={add} style={({ pressed }) => [s.addBtn, !draft.trim() && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}>
            <T w={600}>Add</T>
          </Pressable>
        </View>
      ) : (
        <T s={12} c={C.mut}>
          That's {MAX_GOALS} goals. Remove one to add another.
        </T>
      )}
      {items.length ? (
        <T s={12} c={C.mut}>
          {done} of {items.length} done
        </T>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { padding: 14, gap: 10, backgroundColor: C.s2, borderWidth: 1, borderColor: C.line, borderRadius: 16 },
  now: { borderColor: '#8A847D', borderWidth: 1.5 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: C.line3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  tick: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: CONTROL_LINE, alignItems: 'center', justifyContent: 'center' },
  x: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  field: { flex: 1, backgroundColor: '#0B0A09', borderWidth: 1, borderColor: C.line, borderRadius: 12, color: C.tx, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  addBtn: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: C.s3, borderWidth: 1, borderColor: C.line3, alignItems: 'center', justifyContent: 'center' },
});
