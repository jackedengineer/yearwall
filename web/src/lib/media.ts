import { useSyncExternalStore } from 'react';

/** True while the media query matches, e.g. useMediaQuery('(min-width: 1024px)'). */
export function useMediaQuery(q: string) {
  return useSyncExternalStore(
    (fn) => {
      const m = matchMedia(q);
      m.addEventListener('change', fn);
      return () => m.removeEventListener('change', fn);
    },
    () => matchMedia(q).matches,
  );
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
