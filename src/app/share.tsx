import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { WeekShareCard, YearShareCard } from '@/components/share-cards';
import { Btn, ModalScreen, T } from '@/components/ui';
import { C } from '@/theme';
import { clampWeek, todayS, weekOf } from '@/utils/dates';

export default function ShareSheet() {
  const { kind, w } = useLocalSearchParams<{ kind?: string; w?: string }>();
  const isWeek = kind === 'week';
  const week = clampWeek(Number(w) || weekOf(todayS()));
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1080, height: isWeek ? 1080 : 1350, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your Year Wall', UTI: 'public.png' });
    } catch (e: any) {
      Alert.alert("Couldn't create the image", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalScreen title={isWeek ? 'Share this week' : 'Share your year'}>
      <View style={{ alignItems: 'center' }}>
        <View ref={ref} collapsable={false} style={{ borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
          {isWeek ? <WeekShareCard w={week} /> : <YearShareCard />}
        </View>
      </View>
      <T s={12} c={C.mut} style={{ textAlign: 'center' }}>
        {isWeek ? 'Saved at 1080 × 1080.' : 'Saved at 1080 × 1350, the size Instagram uses for portrait posts.'}
      </T>
      <Btn label={busy ? 'Preparing…' : 'Share or save image'} icon="share" onPress={share} disabled={busy} />
    </ModalScreen>
  );
}
