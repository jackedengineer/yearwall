/**
 * One toast at a time, above the tab bar, with an optional Undo. TalkBack and
 * VoiceOver read every message. Toasts with Undo stay 10 s (5 s otherwise).
 * Slides up 10 px and scales from 0.98 in 200 ms; with reduced motion it just appears.
 *
 *   toast({ message: 'Deep work logged. 3 of 6 this week, 3 to go.', undo: () => ... });
 */
import Feather from '@expo/vector-icons/Feather';
import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, MOTION } from '@/theme';
import { T } from './ui';

export type Toast = { message: string; undo?: () => void; undoLabel?: string };
type Shown = Toast & { id: number };

let current: Shown | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastUndo: { run: () => void; until: number } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function toast(t: Toast) {
  current = { ...t, id: ++seq };
  lastUndo = t.undo ? { run: t.undo, until: Date.now() + 60_000 } : null;
  if (timer) clearTimeout(timer);
  timer = setTimeout(dismissToast, t.undo ? MOTION.toast.undoMs : MOTION.toast.visibleMs);
  AccessibilityInfo.announceForAccessibility(t.undo ? `${t.message} Undo is available.` : t.message);
  notify();
}

export function dismissToast() {
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  notify();
}

/** Runs the latest toast's Undo once. */
export function runUndo(): boolean {
  const u = lastUndo;
  if (!u || Date.now() > u.until) return false;
  lastUndo = null;
  u.run();
  toast({ message: 'Undone.' });
  return true;
}

const slideUp = {
  from: { opacity: 0, transform: [{ translateY: MOTION.toast.fromY }, { scale: MOTION.toast.fromScale }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
};

/** Lives once at the root, over every screen. */
export function ToastHost() {
  const t = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => current,
  );
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  if (!t) return null;
  return (
    <View pointerEvents="box-none" style={[s.region, { bottom: insets.bottom + 64 }]}>
      <Animated.View
        key={t.id}
        accessibilityLiveRegion="polite"
        style={[
          s.toast,
          !reduced && {
            animationName: slideUp,
            animationDuration: MOTION.toast.ms,
            animationTimingFunction: cubicBezier(0.2, 0.8, 0.2, 1),
          },
        ]}
      >
        <T s={14} c={C.tx} style={{ flex: 1 }}>
          {t.message}
        </T>
        {t.undo ? (
          <Pressable onPress={() => runUndo()} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [s.undo, pressed && { opacity: 0.6 }]}>
            <T w={700} s={14} c={C.bg}>
              {t.undoLabel ?? 'Undo'}
            </T>
          </Pressable>
        ) : null}
        <Pressable onPress={dismissToast} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8} style={s.x}>
          <Feather name="x" size={16} color={C.mut} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  region: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 8,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#1C1A18',
    borderWidth: 1,
    borderColor: '#34302C',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
  },
  undo: { minHeight: 36, paddingHorizontal: 14, borderRadius: 10, backgroundColor: C.lit, alignItems: 'center', justifyContent: 'center' },
  x: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
