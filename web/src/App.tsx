import { useEffect, useState, type ComponentType } from 'react';
import { S, UI, commit } from '@core/data/state';
import { todayS } from '@core/utils/dates';
import { boot, checkKey, hasData, startFresh, type Boot } from '@web/data/sync-web';
import Feather from '@web/lib/icons';
import { match, router, TABS, useLocation, type ModalRoute } from '@web/lib/router';
import { C } from '@web/lib/theme';
import { useStore } from '@web/lib/use-store';
import ChapterEdit from '@web/modals/chapter-edit';
import HabitSheet from '@web/modals/habit';
import IncomeSheet from '@web/modals/income';
import Intro from '@web/modals/intro';
import MinutesSheet from '@web/modals/minutes';
import PlanSheet from '@web/modals/plan';
import PostSheet from '@web/modals/post';
import SettingsSheet from '@web/modals/settings';
import ShareSheet from '@web/modals/share';
import TargetSheet from '@web/modals/target';
import TestSheet from '@web/modals/test';
import WeekSheet from '@web/modals/week';
import { ChapterScreen } from '@web/screens/chapter';
import { Content } from '@web/screens/content';
import { Money } from '@web/screens/money';
import { Today } from '@web/screens/today';
import { Year } from '@web/screens/year';
import { Btn, Field, T } from '@web/ui';
import { ConfirmHost } from '@web/components/confirm';
import { Sidebar, useSidebarCollapsed } from '@web/components/sidebar';
import { ToastHost } from '@web/components/toast';

const PAGES: Record<(typeof TABS)[number], { title: string; icon: string; C: ComponentType }> = {
  '/': { title: 'Today', icon: 'sun', C: Today },
  '/year': { title: 'Year', icon: 'grid', C: Year },
  '/chapter': { title: 'Chapter', icon: 'book', C: ChapterScreen },
  '/content': { title: 'Content', icon: 'video', C: Content },
  '/money': { title: 'Money', icon: 'credit-card', C: Money },
};

const MODALS: Record<ModalRoute, ComponentType> = {
  '/week/[w]': WeekSheet,
  '/plan/[id]': PlanSheet,
  '/post/[id]': PostSheet,
  '/income/[id]': IncomeSheet,
  '/test/[id]': TestSheet,
  '/chapter-edit/[id]': ChapterEdit,
  '/habit/[id]': HabitSheet,
  '/minutes/[hid]': MinutesSheet,
  '/settings': SettingsSheet,
  '/target': TargetSheet,
  '/share': ShareSheet,
  '/intro': Intro,
};

export default function App() {
  const [phase, setPhase] = useState<Boot | 'loading'>('loading');
  useEffect(() => {
    boot().then(setPhase);
  }, []);

  if (phase === 'loading') return <Splash text="Loading your year…" />;
  if (phase === 'need-key' || phase === 'bad-key')
    return (
      <SignIn
        error={phase === 'bad-key' ? 'That sync key no longer works. Enter it again.' : ''}
        onDone={() => {
          setPhase('loading');
          boot().then(setPhase);
        }}
      />
    );
  if (phase === 'offline')
    return (
      <Splash text="Couldn't reach your Year Wall server.">
        <Btn
          label="Try again"
          icon="refresh-cw"
          onPress={() => {
            setPhase('loading');
            boot().then(setPhase);
          }}
        />
      </Splash>
    );
  if (phase === 'empty') return <WaitForPhone />;
  return <Shell />;
}

/** The server is empty: the phone's first sync fills it, and this page switches over by itself. */
function WaitForPhone() {
  useStore();
  if (hasData()) return <Shell />;
  return (
    <Splash text="Your year isn't on the server yet. On your phone, open Year Wall, go to Settings, then Sync, enter this same sync key and tap Connect. This page fills in by itself a few seconds later.">
      <Btn
        label="Start fresh here instead"
        kind="ghost"
        onPress={() => {
          if (window.confirm('Start with the Chapter 1 plan on the web? If your phone already has data, connect the phone first instead, or its edits to the starting plan will be replaced.')) startFresh();
        }}
      />
    </Splash>
  );
}

function Splash({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="center">
      <div className="center-box">
        <div className="brand">Year Wall</div>
        <T c={C.mut}>{text}</T>
        {children}
      </div>
    </div>
  );
}

function SignIn({ error, onDone }: { error: string; onDone: () => void }) {
  const [key, setKey] = useState('');
  const [err, setErr] = useState(error);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!key.trim()) return;
    setBusy(true);
    const problem = await checkKey(key.trim());
    setBusy(false);
    if (problem) setErr(problem);
    else onDone();
  };
  return (
    <div className="center">
      <form
        className="center-box"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="brand">Year Wall</div>
        <T c={C.mut} style={{ textAlign: 'center' }}>
          Enter your sync key. It's the same key you use in the phone app's Settings.
        </T>
        <Field label="Sync key" value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} autoFocus placeholder="xxxxx-xxxxx-xxxxx-xxxxx" />
        {err ? (
          <T s={13} c={C.danger}>
            {err}
          </T>
        ) : null}
        <Btn label={busy ? 'Checking…' : 'Open my year'} onPress={() => void submit()} disabled={busy || !key.trim()} />
      </form>
    </div>
  );
}

let lastTab: (typeof TABS)[number] = '/';

function Shell() {
  useStore();
  const [collapsed, toggleSidebar] = useSidebarCollapsed();
  const loc = useLocation();
  const m = match(loc.split('?')[0]);
  if (m && (TABS as readonly string[]).includes(m.route)) lastTab = m.route as (typeof TABS)[number];
  const tab = lastTab;
  const Modal = m && !(TABS as readonly string[]).includes(m.route) ? MODALS[m.route as ModalRoute] : null;
  const Page = PAGES[tab].C;

  // Unknown address: go to Today.
  useEffect(() => {
    if (!m) router.replace('/');
  }, [m]);

  // First visit: show the intro, like the phone does.
  useEffect(() => {
    if (!S.meta.settings.tourDone && !Modal) {
      const t = setTimeout(() => router.push('/intro'), 400);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming back on a new day moves Today forward, unless you were looking at an older day.
  useEffect(() => {
    let last = todayS();
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const t = todayS();
      if (t !== last) {
        if (UI.day === last) UI.day = t;
        last = t;
        commit();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Keep the page behind a dialog from scrolling.
  useEffect(() => {
    document.body.classList.toggle('locked', !!Modal);
  }, [Modal]);

  useEffect(() => {
    document.title = Modal ? 'Year Wall' : `${PAGES[tab].title} · Year Wall`;
  }, [tab, Modal]);

  // Wide screens show today's habits beside every tab except Today (which has them already).
  const side = tab !== '/';
  return (
    <>
      <nav className={side ? 'tabs wide' : 'tabs'} aria-label="Sections">
        <span className="brand small">Year Wall</span>
        {TABS.map((p) => (
          <a
            key={p}
            href={p}
            className={p === tab ? 'tab on' : 'tab'}
            aria-current={p === tab ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              if (p !== tab || Modal) router.push(p);
            }}
          >
            <Feather name={PAGES[p].icon} size={20} color={p === tab ? C.tx : C.mut2} />
            <span>{PAGES[p].title}</span>
          </a>
        ))}
      </nav>
      <div className={`layout${side ? ' side' : ''}${side && collapsed ? ' collapsed' : ''}`}>
        {side ? <Sidebar collapsed={collapsed} onToggle={toggleSidebar} /> : null}
        <div className="page">
          <Page />
        </div>
      </div>
      {Modal ? (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && router.back()}>
          <div className="dialog" role="dialog" aria-modal="true">
            <Modal />
          </div>
        </div>
      ) : null}
      <ToastHost />
      <ConfirmHost />
    </>
  );
}
