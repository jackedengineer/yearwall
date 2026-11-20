/** Moves the screen reader (TalkBack, VoiceOver) to `el`. Does nothing where that isn't supported. */
import { AccessibilityInfo, type HostInstance } from 'react-native';

export function focusForScreenReader(el: HostInstance | null | undefined) {
  if (!el) return;
  try {
    AccessibilityInfo.sendAccessibilityEvent?.(el, 'focus');
  } catch {
    // Not available (e.g. a web preview): focus just stays where it was.
  }
}
