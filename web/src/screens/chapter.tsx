// Web version of src/screens/chapter.tsx (ported from the phone app).
import { router } from '@web/lib/router';
import { Pressable, View } from '@web/lib/rn';
import { Bar, Btn, Card, Empty, IconBtn, PageTitle, Screen, Section, T } from '@web/ui';
import { commit, UI } from '@core/data/state';
import { useStore } from '@web/lib/use-store';
import { C } from '@web/lib/theme';
import { diff, fmtRange, plural, todayS } from '@core/utils/dates';
import { chapterAt, hexMix, nextChapter, phaseAt, sortedChapters, testProgress } from '@core/utils/logic';

export function ChapterScreen() {
  useStore();
  const t = todayS();
  const cs = sortedChapters();
  if (!cs.length)
    return (
      <Screen>
        <PageTitle>Chapters</PageTitle>
        <Empty>No chapters yet.</Empty>
        <Btn label="Add a chapter" onPress={() => router.push({ pathname: '/chapter-edit/[id]', params: { id: 'new' } })} />
      </Screen>
    );
  const c = cs.find((x) => x.id === UI.chapterId) || chapterAt(t) || nextChapter(t) || cs[cs.length - 1];
  const idx = cs.indexOf(c);
  const ph = phaseAt(c, t);
  const isNow = t >= c.start && t <= c.end;
  const status = t < c.start ? `Starts in ${plural(diff(t, c.start), 'day')}` : t > c.end ? 'Finished' : `${plural(diff(t, c.end), 'day')} left`;
  const go = (i: number) => {
    UI.chapterId = cs[i].id;
    commit();
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <T w={600} s={13} c={C.mut}>
            Chapter {c.n} of {cs.length}, {fmtRange(c.start, c.end)}
          </T>
          <PageTitle>{c.name}</PageTitle>
          <T s={14} c={C.tx2}>
            {c.skill}
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <IconBtn name="chevron-left" label="Previous chapter" disabled={idx <= 0} onPress={() => go(idx - 1)} />
          <IconBtn name="chevron-right" label="Next chapter" disabled={idx >= cs.length - 1} onPress={() => go(idx + 1)} />
        </View>
      </View>

      <Card style={{ padding: 14, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T w={600} s={12}>
            {ph ? `Phase: ${ph.name}` : c.phases.length ? (isNow ? 'Between phases' : 'Phases') : 'No phases yet'}
          </T>
          <T w={600} s={12} c={C.mut}>
            {status}
          </T>
        </View>
        {c.phases.length ? (
          <>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {c.phases.map((p, i) => {
                const len = diff(p.start, p.end) + 1;
                const bg = t > p.end ? C.lit : ph === p ? hexMix('#4A4642', '#ECE8E2', (diff(p.start, t) + 1) / len) : C.line;
                return <View key={i} style={{ flex: len, height: 8, borderRadius: 3, backgroundColor: bg }} />;
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {c.phases.map((p, i) => (
                <T key={i} w={600} s={10} c={ph === p ? C.tx : C.mut} numberOfLines={1} style={{ flex: diff(p.start, p.end) + 1 }}>
                  {p.name}
                </T>
              ))}
            </View>
            {ph?.note ? (
              <T s={13} c={C.tx2} style={{ lineHeight: 20 }}>
                {ph.note}
              </T>
            ) : null}
          </>
        ) : null}
      </Card>

      <Section left="Finish line" right="Day 0 to target" />
      {c.tests.length ? (
        <Card>
          {c.tests.map((tt, i) => {
            const right = tt.latest != null ? `${tt.latest} / ${tt.target ?? '?'} ${tt.unit}` : tt.baseline == null ? 'Add Day 0' : `${tt.baseline} ${tt.unit}`;
            const sub = [
              tt.better === 'lower' ? 'Lower is better.' : '',
              tt.baseline != null ? `Day 0: ${tt.baseline} ${tt.unit}.` : '',
              tt.latest != null ? `Latest: ${tt.latest} ${tt.unit}.` : '',
              tt.target == null ? 'Set a target.' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <Pressable
                key={tt.id}
                onPress={() => router.push({ pathname: '/test/[id]', params: { id: tt.id, cid: c.id } })}
                style={({ pressed }) => [{ padding: 14, gap: 7, borderTopWidth: i ? 1 : 0, borderTopColor: C.line2 }, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <T w={600} style={{ flex: 1 }}>
                    {tt.name}
                  </T>
                  <T w={600}>{right}</T>
                </View>
                <Bar pct={testProgress(tt) * 100} />
                <T s={11} c={C.mut}>
                  {sub || 'Click to add your numbers.'}
                </T>
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <Empty>No finish-line tests yet. Add the test you'll take at the end of this chapter.</Empty>
      )}
      <Btn label="Add a test" kind="ghost" onPress={() => router.push({ pathname: '/test/[id]', params: { id: 'new', cid: c.id } })} />

      <Section left="Roadmap" />
      <Card>
        {cs.map((x, i) => {
          const now = t >= x.start && t <= x.end;
          return (
            <Pressable
              key={x.id}
              onPress={() => router.push({ pathname: '/chapter-edit/[id]', params: { id: x.id } })}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 50, borderTopWidth: i ? 1 : 0, borderTopColor: C.line2 }, pressed && { opacity: 0.7 }]}
            >
              <View style={{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: now ? C.lit : C.s4 }}>
                <T w={700} s={12} c={now ? C.bg : C.tx2}>
                  {x.n}
                </T>
              </View>
              <T w={600} style={{ flex: 1 }}>
                {x.name}
              </T>
              <T s={12} c={C.mut}>
                {fmtRange(x.start, x.end)}
              </T>
            </Pressable>
          );
        })}
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Edit this chapter" kind="ghost" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/chapter-edit/[id]', params: { id: c.id } })} />
        <Btn label="Add a chapter" kind="ghost" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/chapter-edit/[id]', params: { id: 'new' } })} />
      </View>
    </Screen>
  );
}
