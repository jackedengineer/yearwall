// Web version of src/screens/money.tsx (ported from the phone app).
import Feather from '@web/lib/icons';
import { router } from '@web/lib/router';
import { Pressable, View } from '@web/lib/rn';
import { Bar, Card, Empty, Screen, Section, T } from '@web/ui';
import { SOURCES, SRC } from '@core/constants';
import { commit, S, UI } from '@core/data/state';
import { useStore } from '@web/lib/use-store';
import { C } from '@web/lib/theme';
import { fmt, monKey, MONTHS, MONTHS_LONG, todayS, YEAR_START } from '@core/utils/dates';
import { money, moneyMonths } from '@core/utils/logic';

export function Money() {
  useStore();
  const months = moneyMonths();
  if (!UI.moneyMonth || !months.includes(UI.moneyMonth)) {
    const t = todayS();
    UI.moneyMonth = months.includes(monKey(t)) ? monKey(t) : monKey(YEAR_START);
  }
  const sel = UI.moneyMonth;
  const tot = (m: string) => S.income.filter((e) => monKey(e.date) === m).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const totals = months.map(tot);
  const target = Number(S.meta.settings.monthlyTarget) || 0;
  const max = Math.max(target, ...totals, 1);
  const selTot = tot(sel);
  const [sy, sm] = sel.split('-').map(Number);
  const yearTot = totals.reduce((a, b) => a + b, 0);
  const entries = S.income.filter((e) => monKey(e.date) === sel).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T w={700} s={28} style={{ lineHeight: 34 }}>
          Money
        </T>
        <Pressable
          onPress={() => router.push({ pathname: '/income/[id]', params: { id: 'new' } })}
          accessibilityRole="button"
          accessibilityLabel="Add income"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.lit, alignItems: 'center', justifyContent: 'center' }}
        >
          <Feather name="plus" size={22} color={C.bg} />
        </Pressable>
      </View>

      <Card style={{ padding: 16, gap: 10 }}>
        <T w={600} s={12} c={C.mut}>
          {MONTHS_LONG[sm - 1]} {sy}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <T w={700} s={34} style={{ letterSpacing: -0.7, lineHeight: 42 }}>
            {money(selTot)}
          </T>
          {target ? (
            <T s={13} c={C.mut}>
              of {money(target)} target
            </T>
          ) : null}
        </View>
        <Bar pct={target ? (selTot / target) * 100 : 0} h={6} />
        <Pressable onPress={() => router.push('/target')} accessibilityRole="button">
          <T s={12} c={C.mut} style={{ textDecorationLine: 'underline' }}>
            {target ? 'Change target' : 'Set a monthly target'}
          </T>
        </Pressable>
      </Card>

      <Section left="The chapter year, by month" right={`${money(yearTot)} total`} />
      <Card style={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 96 }}>
          {months.map((m, i) => (
            <Pressable
              key={m}
              onPress={() => {
                UI.moneyMonth = m;
                commit();
              }}
              accessibilityLabel={`${MONTHS_LONG[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}: ${money(totals[i])}`}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
            >
              <View style={{ height: Math.max(3, Math.round((totals[i] / max) * 96)), borderRadius: 3, backgroundColor: m === sel ? C.lit : C.off }} />
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
          {months.map((m) => (
            <T key={m} w={600} s={9} c={m === sel ? C.tx : C.mut} style={{ flex: 1, textAlign: 'center' }}>
              {MONTHS[Number(m.slice(5)) - 1][0]}
            </T>
          ))}
        </View>
      </Card>

      <Section left="By source, this year" />
      <Card>
        {SOURCES.map((s, i) => {
          const v = S.income.filter((e) => e.source === s.id).reduce((a, e) => a + (Number(e.amount) || 0), 0);
          return (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line2 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
              <T w={600} style={{ flex: 1 }}>
                {s.name}
              </T>
              <T w={600}>{money(v)}</T>
            </View>
          );
        })}
      </Card>

      <Section left={`Entries in ${MONTHS_LONG[sm - 1]}`} right={entries.length ? String(entries.length) : undefined} />
      {entries.length ? (
        <Card>
          {entries.map((e, i) => {
            const src = SRC[e.source] ?? SRC.other;
            return (
              <Pressable
                key={e.id}
                onPress={() => router.push({ pathname: '/income/[id]', params: { id: e.id } })}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line2 }, pressed && { opacity: 0.7 }]}
              >
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: src.color }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T w={600}>{e.note || src.name}</T>
                  <T s={12} c={C.mut}>
                    {fmt(e.date, { wd: true })}, {src.name}
                  </T>
                </View>
                <T w={700}>{money(e.amount)}</T>
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <Empty>No income logged for this month. Add a payment with the + button when it lands.</Empty>
      )}
    </Screen>
  );
}
