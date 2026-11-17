/**
 * The web version of the phone's UI kit (src/components/ui.tsx): same
 * components and props, built from plain DOM elements.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { addD, fmt, isDate, todayS } from '@core/utils/dates';
import Feather, { type IconName } from '@web/lib/icons';
import { Pressable, StyleSheet, Text, View, css, type StyleProp, type TextStyle, type ViewStyle } from '@web/lib/rn';
import { router } from '@web/lib/router';
import { C, font, type Weight } from '@web/lib/theme';

export type { IconName };

/* ---------- text ---------- */
export function T({
  w = 500,
  s = 14,
  c = C.tx,
  style,
  children,
  numberOfLines,
  ...rest
}: { w?: Weight; s?: number; c?: string; style?: StyleProp<TextStyle>; children?: ReactNode; numberOfLines?: number; accessibilityLabel?: string }) {
  return (
    <Text {...rest} numberOfLines={numberOfLines} style={[{ fontSize: s, color: c, lineHeight: Math.round(s * 1.4) }, font(w), style]}>
      {children}
    </Text>
  );
}

/* ---------- layout ---------- */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="screen">
      <View style={{ paddingTop: 22, paddingHorizontal: 18, paddingBottom: 48, gap: 18 }}>{children}</View>
    </main>
  );
}

/** The content of a dialog (every non-tab route). The dialog frame itself is in App.tsx. */
export function ModalScreen({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && router.back();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <>
      <View style={styles.modalHead}>
        <T w={700} s={22} style={{ flex: 1 }}>
          {title}
        </T>
        {right}
        <IconBtn name="x" label="Close" onPress={() => router.back()} />
      </View>
      <div className="modal-body">
        <View style={{ padding: 18, paddingTop: 4, paddingBottom: 32, gap: 16 }}>{children}</View>
      </div>
    </>
  );
}

export function Card({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  if (onPress)
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  return <View style={[styles.card, style]}>{children}</View>;
}

export const Sep = () => <View style={styles.sep} />;

export function Section({ left, right }: { left: string; right?: string }) {
  return (
    <View style={styles.section}>
      <T w={600} s={13} c={C.mut}>
        {left}
      </T>
      {right ? (
        <T w={600} s={13} c={C.mut}>
          {right}
        </T>
      ) : null}
    </View>
  );
}

export function Empty({ children }: { children: string }) {
  return (
    <Card style={{ padding: 16 }}>
      <T s={13} c={C.mut} style={{ lineHeight: 20 }}>
        {children}
      </T>
    </Card>
  );
}

export function Banner({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.banner}>
      <T s={12} c={C.mut} style={{ lineHeight: 18 }}>
        {children}
      </T>
    </Pressable>
  );
}

export function Bar({ pct, h = 4, color = C.lit }: { pct: number; h?: number; color?: string }) {
  return (
    <View style={{ height: h, borderRadius: h, backgroundColor: C.off, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color, borderRadius: h }} />
    </View>
  );
}

export const Dot = ({ color, size = 8 }: { color: string; size?: number }) => <View style={{ width: size, height: size, borderRadius: 2, backgroundColor: color }} />;

/* ---------- controls ---------- */
export function IconBtn({ name, onPress, label, disabled, size = 44, iconSize = 18 }: { name: IconName; onPress: () => void; label: string; disabled?: boolean; size?: number; iconSize?: number }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, { width: size, height: size, borderRadius: size > 36 ? 12 : 9 }, pressed && styles.pressed, disabled && { opacity: 0.35 }]}
    >
      <Feather name={name} size={iconSize} color={C.tx2} />
    </Pressable>
  );
}

export function Btn({ label, onPress, kind = 'primary', style, disabled, icon }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'danger'; style?: StyleProp<ViewStyle>; disabled?: boolean; icon?: IconName }) {
  const k = kind === 'primary' ? styles.btnPrimary : kind === 'danger' ? styles.btnDanger : styles.btnGhost;
  const tc = kind === 'primary' ? C.bg : kind === 'danger' ? C.danger : C.tx;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.btn, k, pressed && styles.pressed, disabled && { opacity: 0.4, cursor: 'default' }, style]}>
      {icon ? <Feather name={icon} size={16} color={tc} /> : null}
      <T w={kind === 'primary' ? 700 : 600} c={tc}>
        {label}
      </T>
    </Pressable>
  );
}

export function Chip({ label, on, onPress, dot, dim }: { label: string; on?: boolean; onPress?: () => void; dot?: string; dim?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!on } : undefined}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, dim && { opacity: 0.4 }, pressed && styles.pressed]}
    >
      {dot ? <Dot color={dot} /> : null}
      <T s={12} w={on ? 600 : 500} c={on ? C.bg : '#D6D1CB'}>
        {label}
      </T>
    </Pressable>
  );
}

export function Chips({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{children}</View>;
}

export function Pills<V extends string | number>({ options, value, onChange, labels }: { options: V[]; value: V; onChange: (v: V) => void; labels?: Record<string, string> }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={String(o)} onPress={() => onChange(o)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.pill, on && styles.pillOn]}>
            <T s={12} w={600} c={on ? C.bg : C.tx2}>
              {labels?.[String(o)] ?? String(o)}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Label({ children }: { children: string }) {
  return (
    <T w={600} s={12} c={C.mut} style={{ marginBottom: 6 }}>
      {children}
    </T>
  );
}

type FieldProps = {
  label?: string;
  value?: string;
  onChangeText?: (v: string) => void;
  /** Called when the field loses focus (or Enter in a one-line field). */
  onEndEditing?: () => void;
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  editable?: boolean;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'url' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  autoFocus?: boolean;
  selectTextOnFocus?: boolean;
  maxLength?: number;
  multiline?: boolean;
  secureTextEntry?: boolean;
  accessibilityLabel?: string;
  returnKeyType?: string;
  style?: StyleProp<TextStyle>;
};

export function Field({ label, style, multiline, ...p }: FieldProps) {
  const inputMode = p.keyboardType === 'number-pad' ? 'numeric' : p.keyboardType === 'decimal-pad' ? 'decimal' : p.keyboardType === 'url' ? 'url' : p.keyboardType === 'email-address' ? 'email' : undefined;
  const common = {
    value: p.value ?? '',
    placeholder: p.placeholder,
    maxLength: p.maxLength,
    autoFocus: p.autoFocus,
    'aria-label': p.accessibilityLabel ?? label,
    autoCapitalize: p.autoCapitalize === 'none' ? 'off' : p.autoCapitalize,
    autoCorrect: p.autoCorrect === false ? 'off' : undefined,
    spellCheck: p.autoCorrect === false ? false : undefined,
    onFocus: p.selectTextOnFocus ? (e: { target: { select: () => void } }) => e.target.select() : undefined,
    onBlur: () => {
      p.onBlur?.();
      p.onEndEditing?.();
    },
    readOnly: p.editable === false,
    className: 'field',
    style: css([styles.field, font(500), multiline && { minHeight: 80, resize: 'vertical' }, style]),
  };
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      {multiline ? (
        <textarea {...common} rows={3} onChange={(e) => p.onChangeText?.(e.target.value)} />
      ) : (
        <input
          {...common}
          type={p.secureTextEntry ? 'password' : 'text'}
          inputMode={inputMode}
          onChange={(e) => p.onChangeText?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              p.onSubmitEditing?.();
              (e.target as HTMLInputElement).blur();
            }
          }}
        />
      )}
    </View>
  );
}

/** A date with day-step buttons and the browser's date picker. */
export function DateField({ label, value, onChange, optional }: { label: string; value: string | null; onChange: (v: string | null) => void; optional?: boolean }) {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  return (
    <View>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <IconBtn name="chevron-left" label="Day before" size={44} onPress={() => onChange(addD(value || todayS(), -1))} />
        <View style={{ flex: 1 }}>
          <input
            type="date"
            className="field"
            aria-label={label}
            value={text}
            onChange={(e) => {
              const v = e.target.value;
              setText(v);
              if (!v && optional) onChange(null);
              else if (isDate(v)) onChange(v);
            }}
            style={css([styles.field, font(500), { textAlign: 'center', colorScheme: 'dark' }])}
          />
          {value ? (
            <T s={11} c={C.mut} style={{ textAlign: 'center', marginTop: 4 }}>
              {fmt(value, { wd: true, y: true })}
            </T>
          ) : null}
        </View>
        <IconBtn name="chevron-right" label="Day after" size={44} onPress={() => onChange(addD(value || todayS(), 1))} />
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
  card: { backgroundColor: C.s2, borderWidth: 1, borderColor: C.line, borderRadius: 16 },
  pressed: { opacity: 0.7 },
  sep: { height: 1, backgroundColor: C.line2, marginHorizontal: 14 },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: -8, marginTop: 4 },
  banner: { padding: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line3, borderRadius: 12 },
  iconBtn: { backgroundColor: C.s3, borderWidth: 1, borderColor: '#2E2B28', alignItems: 'center', justifyContent: 'center' },
  btn: { minHeight: 46, borderRadius: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnPrimary: { backgroundColor: C.lit },
  btnGhost: { backgroundColor: C.s3, borderWidth: 1, borderColor: C.line3 },
  btnDanger: { backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.dangerLine },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, minHeight: 34, borderRadius: 999, backgroundColor: C.s3, borderWidth: 1, borderColor: '#2E2B28' },
  chipOn: { backgroundColor: C.lit, borderColor: C.lit },
  pill: { flexGrow: 1, minWidth: 42, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#2E2B28', backgroundColor: C.s3, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  pillOn: { backgroundColor: C.lit, borderColor: C.lit },
  field: { width: '100%', backgroundColor: '#0B0A09', borderWidth: 1, borderStyle: 'solid', borderColor: C.line, borderRadius: 12, color: C.tx, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
});
