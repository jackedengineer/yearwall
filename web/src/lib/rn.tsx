/**
 * A few layout building blocks with the same defaults as the phone app's
 * (flex column boxes, RN-style style objects), so screens ported from the
 * phone keep their layout. Plain React DOM: no React Native, no Expo.
 */
import { createElement, useState, type CSSProperties, type ReactNode } from 'react';

export type Style = Record<string, any>;
export type StyleProp<T = Style> = T | false | null | undefined | 0 | '' | StyleProp<T>[];
export type ViewStyle = Style;
export type TextStyle = Style;
export type ColorValue = string;

function flatten(s: StyleProp, out: Style = {}): Style {
  if (!s) return out;
  if (Array.isArray(s)) s.forEach((x) => flatten(x, out));
  else Object.assign(out, s);
  return out;
}

/** Phone-style style object → CSS. */
export function css(s: StyleProp): CSSProperties {
  const src = flatten(s);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined || v === null) continue;
    switch (k) {
      case 'paddingHorizontal':
        out.paddingLeft = out.paddingRight = v;
        break;
      case 'paddingVertical':
        out.paddingTop = out.paddingBottom = v;
        break;
      case 'marginHorizontal':
        out.marginLeft = out.marginRight = v;
        break;
      case 'marginVertical':
        out.marginTop = out.marginBottom = v;
        break;
      case 'lineHeight':
        out.lineHeight = typeof v === 'number' ? `${v}px` : v;
        break;
      case 'fontVariant':
        out.fontVariantNumeric = Array.isArray(v) ? v.join(' ') : v;
        break;
      case 'transform':
        out.transform = Array.isArray(v) ? v.map((t: Style) => Object.entries(t).map(([fn, a]) => `${fn}(${typeof a === 'number' && fn.startsWith('translate') ? a + 'px' : a})`).join(' ')).join(' ') : v;
        break;
      case 'textAlignVertical':
      case 'includeFontPadding':
      case 'elevation':
      case 'shadowColor':
      case 'shadowOffset':
      case 'shadowOpacity':
      case 'shadowRadius':
      case 'resizeMode':
        break;
      default:
        out[k] = v;
    }
  }
  return out;
}

type A11y = {
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
};
const a11y = ({ accessibilityLabel, accessibilityRole, accessibilityState }: A11y) => ({
  'aria-label': accessibilityLabel,
  role: accessibilityRole === 'checkbox' ? 'checkbox' : accessibilityRole === 'button' ? 'button' : undefined,
  'aria-checked': accessibilityRole === 'checkbox' ? !!accessibilityState?.checked : undefined,
  'aria-pressed': accessibilityRole !== 'checkbox' && accessibilityState?.selected !== undefined ? !!accessibilityState.selected : undefined,
});

export function View({ style, children, ...rest }: { style?: StyleProp; children?: ReactNode; collapsable?: boolean; pointerEvents?: string; nativeID?: string } & A11y & { ref?: any }) {
  const { ref, pointerEvents, nativeID } = rest as any;
  return (
    <div ref={ref} id={nativeID} className="v" style={{ ...css(style), ...(pointerEvents === 'none' ? { pointerEvents: 'none' } : {}) }} {...a11y(rest)}>
      {children}
    </div>
  );
}

export function Text({ style, children, numberOfLines, ...rest }: { style?: StyleProp; children?: ReactNode; numberOfLines?: number } & A11y) {
  const clamp: CSSProperties = numberOfLines
    ? numberOfLines === 1
      ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }
      : { display: '-webkit-box', WebkitLineClamp: numberOfLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
    : {};
  return (
    <span className="t" style={{ ...css(style), ...clamp }} {...a11y(rest)}>
      {children}
    </span>
  );
}

type PressableStyle = StyleProp | ((s: { pressed: boolean }) => StyleProp);

/** A tappable box. Renders a real <button> for keyboard and screen-reader use. */
export function Pressable({
  style,
  children,
  onPress,
  disabled,
  ...rest
}: { style?: PressableStyle; children?: ReactNode | ((s: { pressed: boolean }) => ReactNode); onPress?: () => void; disabled?: boolean; hitSlop?: number; onLongPress?: () => void; nativeID?: string } & A11y) {
  const [pressed, setPressed] = useState(false);
  const st = typeof style === 'function' ? style({ pressed }) : style;
  const body = typeof children === 'function' ? children({ pressed }) : children;
  if (!onPress)
    return (
      <div className="v" style={css(st)} {...a11y(rest)}>
        {body}
      </div>
    );
  return (
    <button
      type="button"
      id={rest.nativeID}
      className="v press"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onPress?.();
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={css(st)}
      {...a11y(rest)}
      role={rest.accessibilityRole === 'checkbox' ? 'checkbox' : undefined}
    >
      {body}
    </button>
  );
}

export const StyleSheet = {
  create<T extends Record<string, Style>>(s: T): T {
    return s;
  },
  hairlineWidth: 1,
  absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as Style,
};

export const Platform = { OS: 'web' as const, select: <T,>(o: { web?: T; default?: T }) => o.web ?? o.default };

type AlertButton = { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void };
/** Browser version of the phone's alert dialogs. A dialog with buttons asks for confirmation. */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const text = message ? `${title}\n\n${message}` : title;
    const actions = (buttons || []).filter((b) => b.style !== 'cancel');
    if (!actions.length) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    if (window.confirm(text)) actions[actions.length - 1].onPress?.();
    else (buttons || []).find((b) => b.style === 'cancel')?.onPress?.();
  },
};

export const h = createElement;
