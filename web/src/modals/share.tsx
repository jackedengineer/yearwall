// Web version of src/app/share.tsx (ported from the phone app).
import { useLocalSearchParams } from '@web/lib/router';
import { useRef, useState } from 'react';
import { Alert, View } from '@web/lib/rn';
import { toPng } from 'html-to-image';
import { WeekShareCard, YearShareCard } from '@web/share-cards';
import { Btn, ModalScreen, T } from '@web/ui';
import { C } from '@web/lib/theme';
import { clampWeek, todayS, weekOf } from '@core/utils/dates';

export default function ShareSheet() {
  const { kind, w } = useLocalSearchParams<{ kind?: string; w?: string }>();
  const isWeek = kind === 'week';
  const week = clampWeek(Number(w) || weekOf(todayS()));
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  /** Renders the card at full size (1080 px wide), then shares it or downloads it. */
  const share = async () => {
    const node = ref.current;
    if (!node) return;
    setBusy(true);
    try {
      await document.fonts?.ready;
      const url = await toPng(node, { pixelRatio: 1080 / node.offsetWidth, cacheBust: true });
      const name = isWeek ? `yearwall-week-${week}.png` : 'yearwall-year.png';
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Year Wall' }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e: any) {
      Alert.alert("Couldn't create the image", String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalScreen title={isWeek ? 'Share this week' : 'Share your year'}>
      <View style={{ alignItems: 'center' }}>
        <View ref={ref} style={{ borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
          {isWeek ? <WeekShareCard w={week} /> : <YearShareCard />}
        </View>
      </View>
      <T s={12} c={C.mut} style={{ textAlign: 'center' }}>
        {isWeek ? 'Saved at 1080 × 1080.' : 'Saved at 1080 × 1350, the size Instagram uses for portrait posts.'}
      </T>
      <Btn label={busy ? 'Preparing…' : 'Save image'} icon="share" onPress={share} disabled={busy} />
    </ModalScreen>
  );
}
