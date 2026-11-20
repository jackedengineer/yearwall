import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { ComponentProps, ReactNode, Ref, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  type TextInputInstance,
  type ScrollViewInstance,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, font, Weight } from '@/theme';
import { ScrollCtx, type ScrollInfo } from './scroll-ctx';
import { addD, fmt, isDate, todayS } from '@/utils/dates';

export type IconName = ComponentProps<typeof Feather>['name'];

/* ---------- text ---------- */
export function T({ w = 500, s = 14, c = C.tx, style, ...rest }: TextProps & { w?: Weight; s?: number; c?: string; style?: StyleProp<TextStyle> }) {
  return <Text {...rest} style={[{ fontSize: s, color: c, lineHeight: Math.round(s * 1.4) }, font(w), style]} />;
}

/* ---------- layout ---------- */
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const ref = useRef<ScrollViewInstance>(null);
  const y = useRef(0);
  // The tour scrolls its targets into view through this.
  const scroll = useMemo<ScrollInfo>(() => ({ ref, y }), []);
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Image source={require('../../assets/glow.png')} style={styles.glow} resizeMode="stretch" />
      <ScrollCtx.Provider value={scroll}>
        <ScrollView
          ref={ref}
          onScroll={(e) => {
            y.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
          contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 96, gap: 18 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      </ScrollCtx.Provider>
    </KeyboardAvoidingView>
  );
}

/** Full-screen form used by every modal route. */
export function ModalScreen({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'android' ? insets.top + 12 : 18;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.s1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {Platform.OS === 'ios' ? <View style={styles.grab} /> : null}
      <View style={[styles.modalHead, { paddingTop: top }]}>
        <T w={700} s={22} style={{ flex: 1 }}>
          {title}
        </T>
        {right}
        <IconBtn name="x" label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 4, paddingBottom: insets.bottom + 40, gap: 16 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
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

export function Banner({ children, onPress }: { children: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.banner}>
      <T s={12} c={C.mut} style={{ lineHeight: 18 }}>
        {children}
      </T>
    </Pressable>
  );
}

export function Bar({ pct, h = 4, color = C.lit }: { pct: number; h?: number; color?: string }) {
  return (
    <View style={{ height: h, borderRadius: h, backgroundColor: C.off, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%` as `${number}%`, height: '100%', backgroundColor: color, borderRadius: h }} />
    </View>
  );
}

export const Dot = ({ color, size = 8 }: { color: string; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: 2, backgroundColor: color }} />
);

/* ---------- controls ---------- */
export function IconBtn({ name, onPress, label, disabled, size = 44, iconSize = 18 }: { name: IconName; onPress: () => void; label: string; disabled?: boolean; size?: number; iconSize?: number }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
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
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.btn, k, pressed && styles.pressed, disabled && { opacity: 0.4 }, style]}>
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
      disabled={!onPress}
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

export function Field({ label, style, multiline, ref, ...rest }: TextInputProps & { label?: string; ref?: Ref<TextInputInstance> }) {
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#6F6A65"
        selectionColor={C.lit}
        keyboardAppearance="dark"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...rest}
        style={[styles.field, font(500), multiline && { minHeight: 80 }, style]}
      />
    </View>
  );
}

/** A date with day-step buttons; the middle can be typed as YYYY-MM-DD. */
export function DateField({ label, value, onChange, optional }: { label: string; value: string | null; onChange: (v: string | null) => void; optional?: boolean }) {
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  const commitText = (t: string) => {
    const v = t.trim();
    if (!v && optional) onChange(null);
    else if (isDate(v)) onChange(v);
    else setText(value || '');
  };
  return (
    <View>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <IconBtn name="chevron-left" label="Day before" size={44} onPress={() => onChange(addD(value || todayS(), -1))} />
        <View style={{ flex: 1 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            onEndEditing={(e) => commitText(e.nativeEvent.text)}
            placeholder={optional ? 'None' : 'YYYY-MM-DD'}
            placeholderTextColor="#6F6A65"
            keyboardAppearance="dark"
            autoCorrect={false}
            style={[styles.field, font(500), { textAlign: 'center' }]}
            accessibilityLabel={label}
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
  screen: { flex: 1, backgroundColor: C.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 360, width: '100%', opacity: 0.9 },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#3A3633', alignSelf: 'center', marginTop: 8 },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingBottom: 12 },
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
  field: { backgroundColor: '#0B0A09', borderWidth: 1, borderColor: C.line, borderRadius: 12, color: C.tx, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
});
