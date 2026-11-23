/**
 * Today's habits beside the other tabs on wide screens, so you can log while
 * looking at the board. Collapses to a rail of tick buttons. The collapsed
 * state stays in this browser (view state, not synced).
 */
import { useState } from 'react';
import { S } from '@core/data/state';
import { fmt, todayS } from '@core/utils/dates';
import { isActive } from '@core/utils/logic';
import Feather from '@web/lib/icons';
import { useStore } from '@web/lib/use-store';
import { colorVars, HabitCards, Ring } from './habit-card';

const KEY = 'yearwall.sidebarCollapsed';
const read = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(read);
  const toggle = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem(KEY, v ? '0' : '1');
      } catch {
        /* private mode: still toggles for this visit */
      }
      return !v;
    });
  };
  return [collapsed, toggle] as const;
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  useStore();
  const t = todayS();
  const list = S.meta.habits.filter((h) => isActive(h, t));
  // One toggle button in the same place in both states, so focus stays on it when it's pressed.
  const toggle = (
    <button type="button" className="icon-btn side-toggle" aria-label={collapsed ? "Show today's habits" : "Hide today's habits"} aria-expanded={!collapsed} onClick={onToggle}>
      <Feather name={collapsed ? 'chevrons-right' : 'chevrons-left'} size={18} />
    </button>
  );
  return (
    <aside className={collapsed ? 'sidebar collapsed' : 'sidebar'} aria-label="Today's habits">
      <div className="side-head">
        {toggle}
        {collapsed ? null : <span className="side-title">Habits today, {fmt(t, { wd: true })}</span>}
      </div>
      {collapsed ? (
        <div className="rail">
          {list.map((h) => (
            <span key={h.id} style={colorVars(h)} title={h.name}>
              <Ring h={h} d={t} size={40} />
            </span>
          ))}
        </div>
      ) : list.length ? (
        <HabitCards d={t} compact />
      ) : (
        <p className="hc-line">No habits are scheduled today.</p>
      )}
    </aside>
  );
}
