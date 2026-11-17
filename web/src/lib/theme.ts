/** Same colors as the phone app (src/theme.ts); fonts come from @fontsource/montserrat. */
export { C, type Weight } from '@core/theme';
import type { Weight } from '@core/theme';

export function font(w: Weight) {
  return { fontFamily: 'Montserrat, system-ui, sans-serif', fontWeight: w };
}
