/**
 * Share: Week, Month and Year tabs with a live preview, three options (hide
 * plan titles, habit stats, colour days by habits or plans), then the share
 * sheet with a 1080 × 1350 PNG.
 */
import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, Pressable, useWindowDimensions, View, type ViewInstance } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { MonthShareCard, type ShareOptions, WeekShareCard, YearShareCard } from '@/components/share-cards';
import { Btn, IconBtn, Label, ModalScreen, Pills, T } from '@/components/ui';
import { C, CONTROL_LINE } from '@/theme';
import { clampWeek, monKey, MONTHS_LONG, todayS, weekOf, WEEKS, weekStart } from '@/utils/dates';
import { moneyMonths } from '@/utils/logic';

type Kind = 'week' | 'month' | 'year';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

function Check({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!on)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: on ? C.lit : CONTROL_LINE, backgroundColor: on ? C.lit : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {on ? <Feather name="check" size={16} color={C.bg} /> : null}
      </View>
      <T>{label}</T>
    </Pressable>
  );
}

export default function ShareSheet() {
  const params = useLocalSearchParams<{ kind?: string; w?: string; m?: string }>();
  const t = todayS();
  const months = moneyMonths();
  const [kind, setKind] = useState<Kind>(params.kind === 'week' || params.kind === 'month' ? params.kind : 'year');
  const [week, setWeek] = useState(clampWeek(Number(params.w) || weekOf(t)));
  const [month, setMonth] = useState(() => {
    const want = params.m || (params.w ? monKey(weekStart(Number(params.w))) : monKey(t));
    return months.includes(want) ? want : months[0];
  });
  const [o, setO] = useState<ShareOptions>({ hidePlans: false, stats: true, by: 'habits' });
  const [busy, setBusy] = useState(false);
  const ref = useRef<ViewInstance>(null);
  const { width } = useWindowDimensions();
  // The card is always 360 × 450; narrow phones show it scaled down (the image is the same).
  const scale = Math.min(1, (width - 36) / 362);
  const mi = months.indexOf(month);
  const [y, m] = month.split('-').map(Number);
  const name = kind === 'week' ? `Week ${week}` : kind === 'month' ? `${MONTHS_LONG[m - 1]} ${y}` : 'The year';

  const share = async () => {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1350, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Year Wall', UTI: 'public.png' });
    } catch (e: any) {
      Alert.alert("Couldn't create the image", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalScreen title="Share">
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 3, borderRadius: 12, backgroundColor: C.s2, borderWidth: 1, borderColor: C.line }}>
        {KINDS.map((k) => {
          const on = kind === k.id;
          return (
            <Pressable key={k.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setKind(k.id)} style={{ flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.line : 'transparent' }}>
              <T w={600} c={on ? C.tx : C.mut}>
                {k.label}
              </T>
            </Pressable>
          );
        })}
      </View>
      {kind !== 'year' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconBtn
            name="chevron-left"
            label={kind === 'week' ? 'Previous week' : 'Previous month'}
            disabled={kind === 'week' ? week <= 1 : mi <= 0}
            onPress={() => (kind === 'week' ? setWeek(week - 1) : setMonth(months[mi - 1]))}
          />
          <T w={600} style={{ flex: 1, textAlign: 'center' }} accessibilityLiveRegion="polite">
            {name}
          </T>
          <IconBtn
            name="chevron-right"
            label={kind === 'week' ? 'Next week' : 'Next month'}
            disabled={kind === 'week' ? week >= WEEKS : mi >= months.length - 1}
            onPress={() => (kind === 'week' ? setWeek(week + 1) : setMonth(months[mi + 1]))}
          />
        </View>
      ) : null}
      <View style={{ alignItems: 'center' }} accessible accessibilityRole="image" accessibilityLabel={`Preview of the ${name.toLowerCase()} image`}>
        <View style={{ width: 360 * scale, height: 450 * scale, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
          <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
            <View ref={ref} collapsable={false} style={{ width: 360, height: 450 }}>
              {kind === 'week' ? <WeekShareCard w={week} o={o} /> : kind === 'month' ? <MonthShareCard ym={month} o={o} /> : <YearShareCard o={o} />}
            </View>
          </View>
        </View>
      </View>
      <View>
        <Check label="Hide plan titles" on={o.hidePlans} onChange={(v) => setO({ ...o, hidePlans: v })} />
        <Check label="Include habit stats" on={o.stats} onChange={(v) => setO({ ...o, stats: v })} />
      </View>
      <View>
        <Label>Colour days by</Label>
        <Pills options={['habits', 'plans'] as ShareOptions['by'][]} value={o.by} labels={{ habits: 'Habits', plans: 'Plans' }} onChange={(v) => setO({ ...o, by: v })} />
      </View>
      <T s={12} c={C.mut} style={{ textAlign: 'center' }}>
        Saved at 1080 × 1350, the size Instagram uses for portrait posts.
      </T>
      <Btn label={busy ? 'Preparing…' : 'Share or save image'} icon="share" onPress={share} disabled={busy} />
    </ModalScreen>
  );
}
