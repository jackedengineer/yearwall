/**
 * "Did it happen?" for a plan whose dates have passed. Yes or No records the
 * outcome (it syncs); afterwards it shows ✓ or ✗ with an inline Undo.
 * Plans that haven't ended show nothing.
 */
import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { CAT } from '@/constants';
import { S } from '@/data/state';
import { actions } from '@/data/store';
import type { Plan } from '@/data/types';
import { C } from '@/theme';
import { fmt } from '@/utils/dates';
import { needsOutcome, plansToAnswer } from '@/utils/progress';
import { T } from './ui';

function answer(p: Plan, v: 'done' | 'missed' | null) {
  actions.setPlanOutcome(p.id, v);
  if (v) Haptics.selectionAsync().catch(() => {});
  AccessibilityInfo.announceForAccessibility(v === 'done' ? `${p.title}: happened.` : v === 'missed' ? `${p.title}: didn't happen.` : `${p.title}: answer cleared.`);
}

export function PlanOutcome({ p }: { p: Plan }) {
  if (p.outcome)
    return (
      <View style={s.row}>
        <View style={[s.badge, p.outcome === 'done' ? s.badgeDone : s.badgeMissed]}>
          <Feather name={p.outcome === 'done' ? 'check' : 'x'} size={13} color={p.outcome === 'done' ? C.ok : C.mut} />
          <T w={600} s={12} c={p.outcome === 'done' ? C.ok : C.mut}>
            {p.outcome === 'done' ? 'Happened' : "Didn't happen"}
          </T>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Undo: ${p.title} ${p.outcome === 'done' ? 'happened' : "didn't happen"}`}
          hitSlop={8}
          style={({ pressed }) => [s.undo, pressed && { opacity: 0.6 }]}
          onPress={() => answer(p, null)}
        >
          <T w={600} s={12} c={C.tx2} style={{ textDecorationLine: 'underline' }}>
            Undo
          </T>
        </Pressable>
      </View>
    );
  if (!needsOutcome(p)) return null;
  return (
    <View style={s.row} accessibilityRole="none" accessibilityLabel={`Did ${p.title} happen?`}>
      <T s={12} c={C.mut} importantForAccessibility="no">
        Did it happen?
      </T>
      <Pressable accessibilityRole="button" accessibilityLabel={`Yes, ${p.title} happened`} style={({ pressed }) => [s.btn, pressed && { opacity: 0.6 }]} onPress={() => answer(p, 'done')}>
        <T w={600} s={13}>
          Yes
        </T>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`No, ${p.title} didn't happen`} style={({ pressed }) => [s.btn, pressed && { opacity: 0.6 }]} onPress={() => answer(p, 'missed')}>
        <T w={600} s={13}>
          No
        </T>
      </Pressable>
    </View>
  );
}

/**
 * A short list on Today: the recent plans that still need a Yes or No.
 * Plans answered here stay in the list (with Undo) until the screen goes away.
 */
export function PlansToAnswer() {
  const seen = useRef<string[]>([]);
  plansToAnswer()
    .slice(0, 4)
    .forEach((p) => {
      if (!seen.current.includes(p.id)) seen.current.push(p.id);
    });
  const list = seen.current.map((id) => S.meta.plans.find((p) => p.id === id)).filter((p): p is Plan => !!p);
  if (!list.length) return null;
  return (
    <View style={s.card}>
      <T w={600} s={13} c={C.mut} accessibilityRole="header">
        Did these happen?
      </T>
      {list.map((p) => (
        <View key={p.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: CAT[p.cat]?.color ?? C.mut }} />
            <T s={14} style={{ flex: 1 }}>
              {p.title}
              <T s={12} c={C.mut}>
                {' '}
                · {fmt(p.end || p.start, { wd: true })}
              </T>
            </T>
          </View>
          <View style={{ paddingLeft: 18 }}>
            <PlanOutcome p={p} />
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  btn: { minWidth: 56, minHeight: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: C.line3, backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, minHeight: 30, borderRadius: 999, borderWidth: 1 },
  badgeDone: { backgroundColor: C.okBg, borderColor: C.okLine },
  badgeMissed: { backgroundColor: C.s3, borderColor: C.line3 },
  undo: { minHeight: 40, paddingHorizontal: 8, justifyContent: 'center' },
  card: { gap: 14, padding: 14, backgroundColor: C.s2, borderWidth: 1, borderColor: C.line, borderRadius: 16 },
});
