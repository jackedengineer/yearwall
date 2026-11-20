/**
 * Share a week, a month or the whole year as an image. Live preview with
 * three options (hide plan titles, include habit stats, colour days by habits
 * or plans); saved at 1080 × 1350. A view-only link comes later: it needs a
 * route on the server.
 */
import { toPng } from 'html-to-image';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { clampWeek, monKey, MONTHS_LONG, todayS, weekOf, WEEKS, weekStart } from '@core/utils/dates';
import { moneyMonths } from '@core/utils/logic';
import { useLocalSearchParams } from '@web/lib/router';
import { MonthShareCard, WeekShareCard, YearShareCard, type ShareOptions } from '@web/share-cards';
import { Btn, IconBtn, ModalScreen } from '@web/ui';
import { toast } from '@web/components/toast';

type Kind = 'week' | 'month' | 'year';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

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
  const ref = useRef<HTMLDivElement>(null);

  const mi = months.indexOf(month);
  const [y, m] = month.split('-').map(Number);
  const name = kind === 'week' ? `Week ${week}` : kind === 'month' ? `${MONTHS_LONG[m - 1]} ${y}` : 'The year';

  // The card is always 360 × 450; narrow screens show it scaled down.
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / 362)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Arrow keys, Home and End move between the tabs, as in any tab list. */
  const onTabsKey = (e: KeyboardEvent) => {
    const i = KINDS.findIndex((k) => k.id === kind);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? KINDS.length - 1 : d ? (i + d + KINDS.length) % KINDS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    const next = KINDS[to].id;
    setKind(next);
    requestAnimationFrame(() => document.getElementById(`share-tab-${next}`)?.focus());
  };

  /** Renders the card at 1080 px wide, then shares it (phones) or downloads it. */
  const save = async () => {
    const node = ref.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      await document.fonts?.ready;
      // Always 360 × 450 at 3x, whatever the preview's scale on screen.
      const url = await toPng(node, { width: 360, height: 450, pixelRatio: 3, cacheBust: true });
      const file = kind === 'week' ? `yearwall-week-${week}.png` : kind === 'month' ? `yearwall-${month}.png` : 'yearwall-year.png';
      const blob = await (await fetch(url)).blob();
      const f = new File([blob], file, { type: 'image/png' });
      if (navigator.canShare?.({ files: [f] }) && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ files: [f], title: 'My Year Wall' }).catch(() => {});
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = file;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast({ message: `Saved ${file}.` });
      }
    } catch (e: any) {
      toast({ message: `Couldn't create the image: ${String(e?.message || e)}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalScreen title="Share">
      <div className="share-tabs" role="tablist" aria-label="What to share" onKeyDown={onTabsKey}>
        {KINDS.map((k) => (
          <button
            key={k.id}
            id={`share-tab-${k.id}`}
            type="button"
            role="tab"
            aria-selected={kind === k.id}
            aria-controls="share-preview"
            tabIndex={kind === k.id ? 0 : -1}
            className={kind === k.id ? 'share-tab on' : 'share-tab'}
            onClick={() => setKind(k.id)}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind !== 'year' ? (
        <div className="share-nav">
          <IconBtn
            name="chevron-left"
            label={kind === 'week' ? 'Previous week' : 'Previous month'}
            disabled={kind === 'week' ? week <= 1 : mi <= 0}
            onPress={() => (kind === 'week' ? setWeek(week - 1) : setMonth(months[mi - 1]))}
          />
          <span className="share-nav-label" aria-live="polite">
            {name}
          </span>
          <IconBtn
            name="chevron-right"
            label={kind === 'week' ? 'Next week' : 'Next month'}
            disabled={kind === 'week' ? week >= WEEKS : mi >= months.length - 1}
            onPress={() => (kind === 'week' ? setWeek(week + 1) : setMonth(months[mi + 1]))}
          />
        </div>
      ) : null}

      <div id="share-preview" role="tabpanel" aria-labelledby={`share-tab-${kind}`} className="share-preview" ref={box} style={{ height: 452 * scale }}>
        <div className="share-frame" role="img" aria-label={`Preview of the ${name.toLowerCase()} image`} style={{ transform: `scale(${scale})` }}>
          <div ref={ref} aria-hidden="true" style={{ width: 360, height: 450 }}>
            {kind === 'week' ? <WeekShareCard w={week} o={o} /> : kind === 'month' ? <MonthShareCard ym={month} o={o} /> : <YearShareCard o={o} />}
          </div>
        </div>
      </div>

      <fieldset className="share-opts">
        <legend className="sr-only">Options</legend>
        <label className="share-check">
          <input type="checkbox" checked={o.hidePlans} onChange={(e) => setO({ ...o, hidePlans: e.target.checked })} />
          Hide plan titles
        </label>
        <label className="share-check">
          <input type="checkbox" checked={o.stats} onChange={(e) => setO({ ...o, stats: e.target.checked })} />
          Include habit stats
        </label>
        <div className="share-by" role="radiogroup" aria-label="Colour days by">
          <span>Colour days by</span>
          {(['habits', 'plans'] as const).map((b) => (
            <label key={b} className={o.by === b ? 'share-radio on' : 'share-radio'}>
              <input type="radio" name="share-by" checked={o.by === b} onChange={() => setO({ ...o, by: b })} />
              {b === 'habits' ? 'Habits' : 'Plans'}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Stays enabled while busy (save() ignores repeat clicks), so focus isn't lost. */}
      <Btn label={busy ? 'Preparing…' : 'Save image'} icon="download" onPress={save} />
      <p className="hc-line" style={{ textAlign: 'center' }}>
        Saved at 1080 × 1350, the portrait size Instagram uses. Categories hidden on the board stay out of the image. A view-only link is coming later.
      </p>
    </ModalScreen>
  );
}
