export type CatId = 'work' | 'learning' | 'health' | 'travel' | 'personal';
export type SourceId = 'freelance' | 'coaching' | 'app' | 'brand' | 'other';
/** Each habit's own colour. Habits saved before colours existed get one from their position (see habitColorId). */
export type HabitColor = 'green' | 'violet' | 'blue' | 'amber' | 'pink' | 'teal';

export type Settings = {
  currency: string;
  monthlyTarget: number;
  weeklyPostTarget: number;
  tourDone: boolean;
  day0: string;
};

export type Test = {
  id: string;
  name: string;
  unit: string;
  better: 'higher' | 'lower';
  baseline: number | null;
  target: number | null;
  latest: number | null;
};

export type Phase = { name: string; start: string; end: string; note: string };

export type Chapter = {
  id: string;
  n: number;
  name: string;
  skill: string;
  start: string;
  end: string;
  tests: Test[];
  phases: Phase[];
};

export type Habit = {
  id: string;
  name: string;
  type: 'check' | 'minutes';
  /** 'journal' = done when that day's journal has text */
  auto?: 'journal' | null;
  step: number;
  daysPerWeek: number;
  targets: { from: string; value: number }[];
  activeFrom: string;
  activeTo: string | null;
  pauses: { from: string; to: string }[];
  color?: HabitColor;
};

/** outcome: set once a plan's dates have passed ("Did it happen?"). Missing means not answered yet. */
export type Plan = { id: string; title: string; start: string; end: string; cat: CatId; milestone?: boolean; outcome?: 'done' | 'missed' };

export type WeekInfo = { focus?: string; notes?: string };
export type GoalItem = { id: string; text: string; done: boolean };
/** A quarter's goals. items (up to 5) is the checklist; text and done mirror it for older clients
 *  (text = item texts, one per line; done = every item done). See goalItems() for reading. */
export type Goal = { text: string; done: boolean; items?: GoalItem[] };
export type GoalKey = 'q1' | 'q2' | 'q3' | 'q4';

export type Meta = {
  v: number;
  settings: Settings;
  chapters: Chapter[];
  habits: Habit[];
  plans: Plan[];
  weeks: Record<string, WeekInfo>;
  goals: Record<GoalKey, Goal>;
};

export type Post = {
  id: string;
  title: string;
  bucket: string;
  format: string;
  platform: string;
  date: string;
  status: string;
  link: string;
};

export type Income = { id: string; date: string; source: SourceId; amount: number; note: string };

export type JournalEntry = { text?: string; feynman?: string; energy?: number | null };

/** In-memory state. Same shape as the web app's backup file. */
export type State = {
  meta: Meta;
  posts: Post[];
  income: Income[];
  /** logs[YYYY-MM][YYYY-MM-DD][habitId] = minutes, or 1 for a check */
  logs: Record<string, Record<string, Record<string, number>>>;
  /** journal[YYYY-MM][YYYY-MM-DD] */
  journal: Record<string, Record<string, JournalEntry>>;
};
