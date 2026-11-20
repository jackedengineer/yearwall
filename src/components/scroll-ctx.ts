/** The screen's scroll view, so the tour can scroll a target into view. Provided by <Screen>. */
import { createContext, type RefObject } from 'react';
import type { ScrollViewInstance } from 'react-native';

export type ScrollInfo = { ref: RefObject<ScrollViewInstance | null>; y: RefObject<number> };
export const ScrollCtx = createContext<ScrollInfo | null>(null);
