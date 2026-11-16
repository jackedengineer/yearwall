import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Bar, Card, Chip, Chips, Empty, IconBtn, Screen, Section, T } from '@/components/ui';
import { BUCKETS, STATUS_COLOR } from '@/constants';
import { commit, S, UI } from '@/data/state';
import { useStore } from '@/hooks/use-store';
import { C } from '@/theme';
import { clampWeek, DOW, fmt, fmtRange, todayS, weekDays, weekOf, WEEKS } from '@/utils/dates';

export function Content() {
  useStore();
  const t = todayS();
  if (!UI.contentWeek) UI.contentWeek = clampWeek(weekOf(t));
  const w = UI.contentWeek;
  const days = weekDays(w);
  const focus = S.meta.weeks[String(w)]?.focus;
  const all = S.posts.filter((p) => days.includes(p.date));
  const posted = all.filter((p) => p.status === 'Posted').length;
  const target = S.meta.settings.weeklyPostTarget || 4;
  const shown = all.filter((p) => UI.bucket === 'All' || p.bucket === UI.bucket);
  const groups = days.map((d) => ({ d, ps: shown.filter((p) => p.date === d) })).filter((g) => g.ps.length);
  const setWeek = (n: number) => {
    UI.contentWeek = clampWeek(n);
    commit();
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T w={700} s={28} style={{ lineHeight: 34 }}>
          Content
        </T>
        <Pressable
          onPress={() => router.push({ pathname: '/post/[id]', params: { id: 'new', date: days.includes(t) ? t : days[0] } })}
          accessibilityRole="button"
          accessibilityLabel="Add post"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.lit, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="plus" size={22} color={C.bg} />
        </Pressable>
      </View>

      <Card style={{ padding: 14, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconBtn name="chevron-left" label="Previous week" size={36} disabled={w <= 1} onPress={() => setWeek(w - 1)} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T w={700} s={13}>
              Week {w}
              {focus ? `, ${focus}` : ''}
            </T>
            <T s={12} c={C.mut}>
              {fmtRange(days[0], days[6])}. {posted} of {target} posted.
            </T>
          </View>
          <IconBtn name="chevron-right" label="Next week" size={36} disabled={w >= WEEKS} onPress={() => setWeek(w + 1)} />
        </View>
        <Bar pct={(posted / target) * 100} h={5} />
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {days.map((d, i) => (
            <View key={d} style={{ flex: 1, gap: 4, alignItems: 'stretch' }}>
              <T w={d === t ? 700 : 600} s={10} c={d === t ? C.tx : C.mut} style={{ textAlign: 'center' }}>
                {DOW[i][0]}
              </T>
              <View style={{ height: 30, borderRadius: 6, backgroundColor: C.fut, padding: 3, gap: 2, justifyContent: 'flex-end', borderWidth: d === t ? 1 : 0, borderColor: C.lit }}>
                {all
                  .filter((p) => p.date === d)
                  .map((p) => (
                    <View key={p.id} style={{ height: 4, borderRadius: 2, backgroundColor: p.status === 'Posted' ? C.lit : C.mid }} />
                  ))}
              </View>
            </View>
          ))}
        </View>
      </Card>

      <Chips>
        {['All', ...BUCKETS].map((b) => (
          <Chip
            key={b}
            label={b}
            on={UI.bucket === b}
            onPress={() => {
              UI.bucket = b;
              commit();
            }}
          />
        ))}
      </Chips>

      {groups.length ? (
        groups.map((g) => (
          <View key={g.d} style={{ gap: 18 }}>
            <Section left={fmt(g.d, { wd: true })} />
            <Card>
              {g.ps.map((p, i) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } })}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line2 }, pressed && { opacity: 0.7 }]}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STATUS_COLOR[p.status] ?? C.mid }} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <T w={600}>{p.title}</T>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {[p.bucket, p.format, p.platform].filter(Boolean).map((x, k) => (
                        <View key={k} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: C.s4 }}>
                          <T w={600} s={11} c={C.tx2}>
                            {x}
                          </T>
                        </View>
                      ))}
                    </View>
                  </View>
                  <T s={12} c={C.mut}>
                    {p.status}
                  </T>
                </Pressable>
              ))}
            </Card>
          </View>
        ))
      ) : (
        <Empty>{UI.bucket === 'All' ? 'No posts planned this week. Add one with the + button.' : `No ${UI.bucket} posts this week.`}</Empty>
      )}
    </Screen>
  );
}
