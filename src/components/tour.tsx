/**
 * A 9-step coach-mark tour over the real screens. Each step switches to its
 * tab, scrolls its target into view and lights it up with a dim cut-out around
 * it; the card has the step count, dots, Back and Next. × or the back button
 * ends it. It starts once on its own (settings.tourSeen < 2) and can be
 * replayed from Settings and "How it works".
 *
 * Targets mark themselves with <TourTarget id="board">…</TourTarget>.
 */
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { type ReactNode, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, type StyleProp, useWindowDimensions, View, type ViewInstance, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { commit, S, UI } from '@/data/state';
import { actions } from '@/data/store';
import { C } from '@/theme';
import { ScrollCtx, type ScrollInfo } from './scroll-ctx';
import { T } from './ui';

type Step = { route: '/' | '/year'; target: string; title: string; body: string };

const STEPS: Step[] = [
  { route: '/', target: 'cards', title: 'Log from Today', body: 'Tap a ring to log a habit. Checks switch on and off; minute habits add one block per tap. The toast that follows has Undo.' },
  { route: '/', target: 'strip', title: 'Streaks and your week', body: 'The flame is your streak. The seven bars are this week, with today outlined. Paused days never break a streak.' },
  { route: '/year', target: 'board', title: 'Your year on one wall', body: 'Fifty-two weeks, one bar per day. Bars light up as you finish your habits, and a coloured cap marks a plan.' },
  { route: '/year', target: 'week', title: 'Open a week', body: 'Tap a week to set its focus, tick past days, add plans and write notes.' },
  { route: '/year', target: 'week', title: 'Plan in one move', body: 'In a week, type a title and pick its days with the Mon to Sun chips. Once a plan is over, it asks whether it happened.' },
  { route: '/', target: 'spot', title: 'Spotlight one habit', body: 'The eye on a habit shows only that habit on the Year board: its done days in its colour, and how many days each week hit.' },
  { route: '/year', target: 'perfect', title: 'Perfect weeks', body: 'A week where every habit hits its target turns green and counts here, along with your best run.' },
  { route: '/year', target: 'goals', title: 'Quarter goals', body: 'Up to five goals for each quarter. Tick them off as you go.' },
  { route: '/year', target: 'share', title: 'Share your progress', body: 'Make an image of a week, a month or the whole year. You can come back to this tour from Settings or "How it works".' },
];


/* ---------- targets ---------- */
type Target = { view: ViewInstance | null; scroll: ScrollInfo | null };
const targets = new Map<string, Target>();

export function TourTarget({ id, style, children }: { id: string; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const scroll = useContext(ScrollCtx);
  const ref = useRef<ViewInstance>(null);
  useEffect(() => {
    const entry = { view: ref.current, scroll };
    targets.set(id, entry);
    return () => {
      if (targets.get(id) === entry) targets.delete(id);
    };
  }, [id, scroll]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

/* ---------- state ---------- */
let step: number | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function startTour() {
  step = 0;
  notify();
}

function finish() {
  step = null;
  notify();
  const st = S.meta.settings;
  if (!st.tourDone || (st.tourSeen ?? 0) < 2) actions.saveSettings({ tourDone: true, tourSeen: 2 });
}

const go = (n: number) => {
  step = n;
  notify();
};

type Rect = { x: number; y: number; w: number; h: number };
const measure = (v: ViewInstance) => new Promise<Rect>((res) => v.measureInWindow((x, y, w, h) => res({ x, y, w, h })));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function TourHost() {
  const i = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => step,
  );
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rect, setRect] = useState<Rect | null>(null);

  // Go to the step's tab, scroll its target into view, then measure it.
  useEffect(() => {
    if (i === null) return;
    const s = STEPS[i];
    let live = true;
    setRect(null);
    if (s.route === '/year' && UI.yearView !== 'weeks') {
      UI.yearView = 'weeks';
      commit();
    }
    router.navigate(s.route);
    AccessibilityInfo.announceForAccessibility(`Tour, step ${i + 1} of ${STEPS.length}: ${s.title}. ${s.body}`);
    (async () => {
      for (let tries = 0; tries < 10 && live; tries++) {
        await wait(tries ? 120 : 350);
        const tg = targets.get(s.target);
        if (!tg?.view) continue;
        let r = await measure(tg.view);
        if (!r.w) continue;
        // Bring it into the top part of the screen, leaving room for the card below.
        const top = insets.top + 24;
        const bottom = win.height * 0.55;
        if (tg.scroll?.ref.current && (r.y < top || r.y > bottom)) {
          const to = Math.max(0, (tg.scroll.y.current ?? 0) + r.y - top - 16);
          tg.scroll.ref.current.scrollTo({ y: to, animated: false });
          await wait(80);
          r = await measure(tg.view);
        }
        if (live) setRect(r);
        return;
      }
      if (live) setRect(null); // nothing to point at: the card still explains the step
    })();
    return () => {
      live = false;
    };
  }, [i, insets.top, win.height]);

  // The Android back button ends the tour.
  useEffect(() => {
    if (i === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      finish();
      return true;
    });
    return () => sub.remove();
  }, [i]);

  if (i === null) return null;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  const pad = 6;
  const hole = rect
    ? {
        x: Math.max(0, rect.x - pad),
        y: Math.max(0, rect.y - pad),
        w: Math.min(win.width, rect.w + pad * 2),
        h: Math.min(win.height - Math.max(0, rect.y - pad), rect.h + pad * 2),
      }
    : null;
  // The card sits below the target when there's room, else at the top.
  const cardBelow = !hole || hole.y + Math.min(hole.h, win.height * 0.5) < win.height * 0.55;
  const scrim = 'rgba(0, 0, 0, 0.62)';

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      {hole ? (
        <>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: hole.y, backgroundColor: scrim }} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: hole.y + hole.h, bottom: 0, backgroundColor: scrim }} />
          <View style={{ position: 'absolute', left: 0, width: hole.x, top: hole.y, height: hole.h, backgroundColor: scrim }} />
          <View style={{ position: 'absolute', left: hole.x + hole.w, right: 0, top: hole.y, height: hole.h, backgroundColor: scrim }} />
          <View pointerEvents="none" style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 14, borderWidth: 2, borderColor: C.lit }} />
          {/* Touches on the lit-up part don't reach the app while the tour is open. */}
          <View style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: scrim }]} />
      )}
      <View style={[st.card, cardBelow ? { bottom: insets.bottom + 72 } : { top: insets.top + 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T w={600} s={12} c={C.mut}>
            {i + 1} of {STEPS.length}
          </T>
          <Pressable accessibilityRole="button" accessibilityLabel="End the tour" hitSlop={8} onPress={finish} style={st.x}>
            <Feather name="x" size={18} color={C.tx2} />
          </Pressable>
        </View>
        <T w={700} s={18} accessibilityRole="header">
          {s.title}
        </T>
        <T s={14} c={C.tx2} style={{ lineHeight: 21 }}>
          {s.body}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', gap: 4, flex: 1 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {STEPS.map((_, k) => (
              <View key={k} style={{ width: k === i ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? C.lit : C.line3 }} />
            ))}
          </View>
          {i > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => go(i - 1)} style={({ pressed }) => [st.btn, st.ghost, pressed && { opacity: 0.7 }]}>
              <T w={600}>Back</T>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => (last ? finish() : go(i + 1))} style={({ pressed }) => [st.btn, st.primary, pressed && { opacity: 0.7 }]}>
            <T w={700} c={C.bg}>
              {last ? 'Done' : 'Next'}
            </T>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: { position: 'absolute', left: 14, right: 14, gap: 8, padding: 16, borderRadius: 18, backgroundColor: '#1C1A18', borderWidth: 1, borderColor: '#3A3633', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)' },
  x: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  btn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ghost: { backgroundColor: C.s3, borderWidth: 1, borderColor: C.line3 },
  primary: { backgroundColor: C.lit },
});
