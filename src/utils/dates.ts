// Dates are local calendar days stored as 'YYYY-MM-DD' strings.
export const YEAR_START = '2026-11-16'; // Week 1 starts on this Monday
export const WEEKS = 52;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n: number) => String(n).padStart(2, '0');

export const ds = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const pd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && ds(pd(s)) === s;
export const addD = (s: string, n: number) => {
  const d = pd(s);
  d.setDate(d.getDate() + n);
  return ds(d);
};
/** Whole days from a to b (b - a). */
export const diff = (a: string, b: string) => Math.round((pd(b).getTime() - pd(a).getTime()) / 864e5);
export const todayS = () => ds(new Date());
/** Monday = 0 … Sunday = 6 */
export const dowI = (s: string) => (pd(s).getDay() + 6) % 7;
export const monKey = (s: string) => s.slice(0, 7);

export const YEAR_END = addD(YEAR_START, WEEKS * 7 - 1);
export const weekOf = (s: string) => Math.floor(diff(YEAR_START, s) / 7) + 1;
export const clampWeek = (w: number) => Math.max(1, Math.min(WEEKS, w));
export const weekStart = (w: number) => addD(YEAR_START, (w - 1) * 7);
export const weekDays = (w: number) => Array.from({ length: 7 }, (_, i) => addD(weekStart(w), i));

export function fmt(s: string, o: { wd?: boolean; y?: boolean } = {}) {
  const d = pd(s);
  let out = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (o.wd) out = `${DOW[dowI(s)]}, ${out}`;
  if (o.y) out += `, ${d.getFullYear()}`;
  return out;
}

export function fmtRange(a: string, b?: string | null) {
  if (!b || a === b) return fmt(a);
  const A = pd(a);
  const B = pd(b);
  if (A.getMonth() === B.getMonth() && A.getFullYear() === B.getFullYear()) return `${fmt(a)} – ${B.getDate()}`;
  return `${fmt(a)} – ${fmt(b)}`;
}

export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
