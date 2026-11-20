/** Feather icons, the same set the phone app uses (@expo/vector-icons/Feather). */
import feather from 'feather-icons';

export type IconName = string;

/** Icons Feather doesn't have, drawn on the same 24px grid with the same stroke. */
const EXTRA: Record<string, string> = {
  flame: '<path d="M12 2.5c.9 2.6 3.2 4.3 4.4 6.4a7 7 0 0 1 .9 3.6 5.3 5.3 0 0 1-10.6 0c0-1.9.8-3.3 1.8-4.4.1 1.4.8 2.5 2 2.8-.6-3 .3-5.8 1.5-8.4z"/>',
};

export default function Feather({ name, size = 18, color = 'currentColor' }: { name: IconName; size?: number; color?: string; style?: unknown }) {
  const extra = EXTRA[name];
  const icon = extra ? { contents: extra } : feather.icons[name as keyof typeof feather.icons];
  if (!icon) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
      dangerouslySetInnerHTML={{ __html: icon.contents }}
    />
  );
}
