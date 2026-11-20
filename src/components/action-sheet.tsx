/**
 * A short list of actions that slides up from the bottom (the ··· menus).
 * The back button, a tap outside and Cancel all close it.
 */
import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '@/theme';
import { type IconName, T } from './ui';

export type SheetAction = { label: string; icon: IconName; onPress: () => void; danger?: boolean };

export function ActionSheet({ title, actions, open, onClose }: { title: string; actions: SheetAction[]; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 10 }]} accessibilityViewIsModal>
        <T w={600} s={13} c={C.mut} style={s.title} accessibilityRole="header">
          {title}
        </T>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            style={({ pressed }) => [s.item, pressed && { backgroundColor: C.s3 }]}
            onPress={() => {
              onClose();
              // Let the sheet close first, so a dialog or a new screen opens on a clean frame.
              setTimeout(a.onPress, 180);
            }}
          >
            <Feather name={a.icon} size={18} color={a.danger ? C.danger : C.tx2} />
            <T w={600} s={15} c={a.danger ? C.danger : C.tx}>
              {a.label}
            </T>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" style={({ pressed }) => [s.item, s.cancel, pressed && { opacity: 0.7 }]} onPress={onClose}>
          <T w={600} s={15} c={C.tx2} style={{ flex: 1, textAlign: 'center' }}>
            Cancel
          </T>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.s1, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: C.line, paddingTop: 8, paddingHorizontal: 10 },
  title: { paddingHorizontal: 12, paddingVertical: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 12, borderRadius: 12 },
  cancel: { marginTop: 6, backgroundColor: C.s3, borderWidth: 1, borderColor: C.line3 },
});
