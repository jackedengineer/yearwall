import type { CatId, SourceId } from './data/types';

export const CATS: { id: CatId; name: string; color: string }[] = [
  { id: 'work', name: 'Work', color: '#6E8BFF' },
  { id: 'learning', name: 'Learning', color: '#A78BFA' },
  { id: 'health', name: 'Health', color: '#34D3B4' },
  { id: 'travel', name: 'Travel', color: '#F2A93B' },
  { id: 'personal', name: 'Personal', color: '#F472B6' },
];
export const CAT = Object.fromEntries(CATS.map((c) => [c.id, c])) as Record<CatId, (typeof CATS)[number]>;

export const BUCKETS = ['Progress', 'Lesson', 'Real moment', 'Story'];
export const FORMATS = ['Short', 'Long', 'Story'];
export const STATUSES = ['Idea', 'Planned', 'Filmed', 'Edited', 'Posted'];
export const STATUS_COLOR: Record<string, string> = {
  Idea: '#33302D',
  Planned: '#4A4642',
  Filmed: '#F2A93B',
  Edited: '#A78BFA',
  Posted: '#86E2AE',
};

export const SOURCES: { id: SourceId; name: string; color: string }[] = [
  { id: 'freelance', name: 'Freelance dev', color: '#6E8BFF' },
  { id: 'coaching', name: 'Coaching', color: '#34D3B4' },
  { id: 'app', name: 'App', color: '#A78BFA' },
  { id: 'brand', name: 'Brand deals', color: '#F2A93B' },
  { id: 'other', name: 'Other', color: '#8A847E' },
];
export const SRC = Object.fromEntries(SOURCES.map((s) => [s.id, s])) as Record<SourceId, (typeof SOURCES)[number]>;
