import type { Chapter, Meta, Post, State, Test } from './types';

/** The plan Year Wall starts with: Chapter 1 (Stillness) in detail, the rest as editable placeholders. */
export function buildTemplate(): State {
  let n = 0;
  const id = (p: string) => p + String(++n).padStart(3, '0');

  const posts: Post[] = [];
  const P = (date: string, title: string, bucket: string, format = 'Short', platform = 'Reels + Shorts') =>
    posts.push({ id: id('p'), title, bucket, format, platform, date, status: 'Planned', link: '' });
  P('2026-11-17', "Series trailer: why I'm spending a year as a beginner", 'Story', 'Long', 'YouTube');
  P('2026-11-17', 'Day 0: my baseline tests', 'Progress');
  P('2026-11-18', 'Day 1: stiff body, busy mind', 'Progress');
  P('2026-11-20', 'I wanted to quit 40 times in 15 minutes', 'Real moment');
  P('2026-11-22', 'Week 1 recap: Day Zero', 'Story');
  P('2026-11-23', 'Sun salutation, explained simply', 'Lesson');
  P('2026-11-25', 'What changed in 7 days', 'Progress');
  P('2026-11-27', 'The wandering mind', 'Real moment');
  P('2026-11-29', 'Week 2 recap: The Struggle', 'Story');
  P('2026-11-30', 'The breathing trick that calms you in 60 seconds', 'Lesson');
  P('2026-12-02', 'First visible progress', 'Progress');
  P('2026-12-04', 'My first 40-minute sit', 'Real moment');
  P('2026-12-06', 'Week 3 recap: First Wins', 'Story');
  P('2026-12-07', 'Why sitting still is a skill', 'Lesson');
  P('2026-12-09', 'The full sequence from memory', 'Progress');
  P('2026-12-11', 'What nobody tells you about meditating daily', 'Real moment');
  P('2026-12-13', 'Mini-retreat day: 5 hours, no phone', 'Real moment');
  P('2026-12-14', 'What 4 weeks taught me about attention', 'Lesson');
  P('2026-12-16', 'Day 0 vs Day 30', 'Progress');
  P('2026-12-19', 'Day 0 vs Day 33, side by side', 'Progress');
  P('2026-12-19', 'Going silent for 10 days', 'Story');
  P('2027-01-05', 'After the silence: 10 days of Vipassana', 'Story', 'Long', 'YouTube');

  const T = (name: string, unit: string, better: Test['better'], target: number | null): Test => ({
    id: id('t'),
    name,
    unit,
    better,
    baseline: null,
    target,
    latest: null,
  });
  const ch = (cid: string, num: number, name: string, skill: string, start: string, end: string, tests: Test[] = [], phases: Chapter['phases'] = []): Chapter => ({
    id: cid,
    n: num,
    name,
    skill,
    start,
    end,
    tests,
    phases,
  });
  const retreat = [{ from: '2026-12-20', to: '2026-12-31' }];

  const meta: Meta = {
    v: 1,
    settings: { currency: '₹', monthlyTarget: 0, weeklyPostTarget: 4, tourDone: false, day0: '2026-11-17' },
    chapters: [
      ch('c1', 1, 'Stillness', 'Yoga and meditation, ending in a 10-day Vipassana retreat', '2026-11-17', '2026-12-31', [
        T('Sit cross-legged without moving', 'min', 'higher', 60),
        T('Single meditation sit', 'min', 'higher', 60),
        T('Mind-wanders in a 10-min sit', 'times', 'lower', null),
        T('Forward fold, fingertips to floor', 'cm', 'lower', 0),
        T('Full yoga sequence from memory', 'min', 'higher', 30),
      ], [
        { name: 'Map', start: '2026-11-17', end: '2026-11-19', note: 'Take the baseline tests, pick one yoga program and one book, list the 12 foundation poses.' },
        { name: 'Drill', start: '2026-11-20', end: '2026-12-03', note: 'Practice daily and film every session for feedback. Add 10 minutes on your two weakest areas. One in-person class a week.' },
        { name: 'Retrieve', start: '2026-12-04', end: '2026-12-13', note: 'Do the full sequence from memory. Explain one thing simply each night. Mini-retreat day on Sunday, Dec 13.' },
        { name: 'Test', start: '2026-12-14', end: '2026-12-19', note: 'Retake the Day 0 tests. Wake earlier, taper caffeine and screens, schedule posts for the retreat.' },
        { name: 'Vipassana', start: '2026-12-20', end: '2026-12-31', note: 'Ten days of silence. No phone, no filming. Habits are paused.' },
      ]),
      ch('c2', 2, 'The Pitch', 'Communication, sales and marketing', '2027-01-08', '2027-02-18', [
        T('Freelance clients landed', 'clients', 'higher', 3),
        T('Coaching clients landed', 'clients', 'higher', 5),
      ]),
      ch('c3', 3, 'The Build', 'Build and sell an app', '2027-02-19', '2027-04-15', [T('Paying users', 'users', 'higher', 50)]),
      ch('c4', 4, 'Strength', 'Calisthenics', '2027-04-16', '2027-05-27'),
      ch('c5', 5, 'The Lens', 'Filmmaking', '2027-05-28', '2027-06-30'),
      ch('c6', 6, 'The Stage', 'Stand-up comedy', '2027-07-01', '2027-07-31'),
      ch('c7', 7, 'New Words', 'Thai, with memory techniques', '2027-08-01', '2027-09-10'),
      ch('c8', 8, 'The Fight', 'Muay Thai in Chiang Mai', '2027-10-01', '2027-10-31'),
      ch('c9', 9, 'The Deep', 'Freediving', '2027-11-01', '2027-11-14'),
    ],
    habits: [
      { id: 'h_med', name: 'Meditation', type: 'minutes', step: 10, daysPerWeek: 7, targets: [{ from: '2026-11-16', value: 30 }, { from: '2026-11-23', value: 50 }, { from: '2026-11-30', value: 80 }, { from: '2026-12-07', value: 100 }, { from: '2026-12-14', value: 120 }], activeFrom: '2026-11-17', activeTo: null, pauses: retreat.map((p) => ({ ...p })) },
      { id: 'h_yoga', name: 'Yoga', type: 'minutes', step: 15, daysPerWeek: 7, targets: [{ from: '2026-11-16', value: 45 }], activeFrom: '2026-11-17', activeTo: null, pauses: retreat.map((p) => ({ ...p })) },
      { id: 'h_read', name: 'Read 10 min', type: 'check', step: 1, daysPerWeek: 7, targets: [{ from: '2026-11-16', value: 1 }], activeFrom: '2026-11-17', activeTo: null, pauses: retreat.map((p) => ({ ...p })) },
      { id: 'h_log', name: 'Nightly log', type: 'check', auto: 'journal', step: 1, daysPerWeek: 7, targets: [{ from: '2026-11-16', value: 1 }], activeFrom: '2026-11-17', activeTo: null, pauses: retreat.map((p) => ({ ...p })) },
    ],
    plans: [
      { id: 'pl1', title: 'Day 0 baseline tests', start: '2026-11-17', end: '2026-11-17', cat: 'learning' },
      { id: 'pl2', title: 'Mini-retreat day', start: '2026-12-13', end: '2026-12-13', cat: 'health' },
      { id: 'pl3', title: 'Day 33 retests', start: '2026-12-19', end: '2026-12-19', cat: 'learning' },
      { id: 'pl4', title: 'Vipassana', start: '2026-12-20', end: '2026-12-31', cat: 'personal', milestone: true },
      { id: 'pl5', title: 'Integration week', start: '2027-01-01', end: '2027-01-07', cat: 'work' },
      { id: 'pl6', title: 'Chiang Mai month', start: '2027-10-01', end: '2027-10-31', cat: 'travel', milestone: true },
    ],
    weeks: {
      '1': { focus: 'Day Zero' },
      '2': { focus: 'The Struggle' },
      '3': { focus: 'First Wins' },
      '4': { focus: 'Going Deeper' },
      '5': { focus: 'Before the Silence' },
      '6': { focus: 'Silence' },
      '7': { focus: 'Silence' },
      '8': { focus: 'After the Silence' },
    },
    goals: {
      q1: { text: '', done: false },
      q2: { text: '', done: false },
      q3: { text: '', done: false },
      q4: { text: '', done: false },
    },
  };
  return { meta, posts, income: [], logs: {}, journal: {} };
}
