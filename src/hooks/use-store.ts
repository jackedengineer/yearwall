import { useSyncExternalStore } from 'react';
import { getVersion, subscribe } from '@/data/state';

/** Re-renders the component whenever any data changes. Read data from S directly. */
export function useStore() {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}
