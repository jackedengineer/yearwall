import { View } from 'react-native';
import { T } from '@/components/ui';
import { S } from '@/data/state';
import { C } from '@/theme';
import { DOW, fmtRange, MONTHS, pd, plural, todayS, weekDays, weekOf, WEEKS, clampWeek } from '@/utils/dates';
import { barColor, capOn, chapterAt, habits, isActive, isPerfect, monthsOfYear, targetOn, valueOn, yearStats } from '@/utils/logic';

/** 360 × 450 card (captured at 3x = 1080 × 1350 for Instagram). */
export function YearShareCard() {
  const t = todayS();
  const cw = clampWeek(weekOf(t));
  const st = yearStats(t);
  const months = monthsOfYear();
  const cols = [months.slice(0, 7), months.slice(7)];
  return (
    <View style={{ width: 360, height: 450, backgroundColor: C.bg, padding: 22, gap: 14 }}>
      <View style={{ gap: 2 }}>
        <T w={700} s={20} style={{ lineHeight: 24 }}>
          Year Wall
        </T>
        <T w={600} s={10} c={C.mut}>
          Week {cw} of {WEEKS}. {plural(st.perfect, 'perfect week')}. {plural(st.active, 'active day')}.
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: 14, flex: 1 }}>
        {cols.map((col, ci) => (
          <View key={ci} style={{ flex: 1, gap: 6 }}>
            {col.map((mo) => (
              <View key={`${mo.y}-${mo.m}`} style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-start' }}>
                <T w={700} s={8} style={{ width: 20, lineHeight: 10, paddingTop: 2 }}>
                  {MONTHS[mo.m]}
                </T>
                {[0, 1, 2, 3, 4].map((i) => {
                  const w = mo.weeks[i];
                  if (!w) return <View key={i} style={{ flex: 1 }} />;
                  const perfect = w <= cw && isPerfect(w, t);
                  return (
                    <View key={i} style={{ flex: 1, height: 38, borderRadius: 5, backgroundColor: C.s1, borderWidth: 1, borderColor: w === cw ? C.lit : perfect ? C.perfect : C.off, padding: 3, gap: 2 }}>
                      <T w={600} s={5} c={C.mut2} style={{ lineHeight: 6 }}>
                        W{w}
                      </T>
                      <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>
                        {weekDays(w).map((d) => {
                          const cap = capOn(d);
                          return (
                            <View key={d} style={{ flex: 1, borderRadius: 1, backgroundColor: barColor(d, t), overflow: 'hidden' }}>
                              {cap ? <View style={{ height: 3, backgroundColor: cap }} /> : null}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </View>
      <T w={600} s={9} c={C.mut2}>
        One year. Many skills. Starting from zero, every time.
      </T>
    </View>
  );
}

/** 360 × 360 card (captured at 3x = 1080 × 1080). */
export function WeekShareCard({ w }: { w: number }) {
  const t = todayS();
  const days = weekDays(w);
  const focus = S.meta.weeks[String(w)]?.focus;
  const ch = chapterAt(days[3]);
  const hs = habits()
    .filter((h) => days.some((d) => isActive(h, d)))
    .slice(0, 6);
  const perfect = isPerfect(w, t);
  const posted = S.posts.filter((p) => days.includes(p.date) && p.status === 'Posted').length;
  return (
    <View style={{ width: 360, height: 360, backgroundColor: C.bg, padding: 22, justifyContent: 'space-between' }}>
      <View style={{ gap: 2 }}>
        <T w={600} s={10} c={C.mut}>
          Week {w} of {WEEKS}
          {ch ? `, Chapter ${ch.n}: ${ch.name}` : ''}
        </T>
        <T w={700} s={22} style={{ lineHeight: 28 }} numberOfLines={1}>
          {focus || fmtRange(days[0], days[6])}
        </T>
        <T s={10} c={C.mut}>
          {fmtRange(days[0], days[6])}, {pd(days[6]).getFullYear()}
        </T>
      </View>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          <View style={{ width: 96 }} />
          {DOW.map((x, i) => (
            <T key={i} w={600} s={8} c={C.mut2} style={{ flex: 1, textAlign: 'center' }}>
              {x[0]}
            </T>
          ))}
        </View>
        {hs.map((h) => (
          <View key={h.id} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
            <T w={600} s={10} numberOfLines={1} style={{ width: 96 }}>
              {h.name}
            </T>
            {days.map((d) => {
              const a = isActive(h, d);
              const v = valueOn(h, d);
              const tg = targetOn(h, d);
              const bg = !a ? '#100F0E' : d > t ? '#141312' : v >= tg ? C.lit : v > 0 ? C.mid : '#1B1918';
              return <View key={d} style={{ flex: 1, aspectRatio: 1, borderRadius: 5, backgroundColor: bg }} />;
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: perfect ? C.okLine : C.line, backgroundColor: perfect ? C.okBg : C.s2 }}>
        <T w={700} s={12} c={perfect ? C.ok : C.tx}>
          {perfect ? 'Perfect week' : `${plural(posted, 'post')} shipped this week`}
        </T>
        <T w={600} s={9} c={C.mut2}>
          Year Wall
        </T>
      </View>
    </View>
  );
}
