/** Feather icons, the same set the phone app uses (@expo/vector-icons/Feather). */
import feather from 'feather-icons';

export type IconName = string;

export default function Feather({ name, size = 18, color = 'currentColor' }: { name: IconName; size?: number; color?: string; style?: unknown }) {
  const icon = feather.icons[name as keyof typeof feather.icons];
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
