import { Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold, useFonts } from '@expo-google-fonts/montserrat';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { openDb } from '@/data/db';
import { UI } from '@/data/state';
import { initStore } from '@/data/store';
import { C, setFontsReady } from '@/theme';
import { YEAR_START, monKey, todayS, weekOf, clampWeek } from '@/utils/dates';

SplashScreen.preventAutoHideAsync().catch(() => {});

let started = false;
function start(): string | null {
  if (started) return null;
  try {
    initStore(openDb());
    const t = todayS();
    UI.day = t < YEAR_START ? YEAR_START : t;
    UI.contentWeek = clampWeek(weekOf(t));
    UI.moneyMonth = monKey(t < YEAR_START ? YEAR_START : t);
    started = true;
    return null;
  } catch (e: any) {
    return String(e?.message || e);
  }
}

export default function RootLayout() {
  const [error] = useState(start);
  const [loaded, fontError] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold });
  const ready = loaded || !!fontError;

  // Set before children render so every screen's first frame uses the right font.
  if (ready) setFontsReady(loaded);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  if (error)
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' }}>
        <Text style={{ color: C.tx, fontSize: 18, marginBottom: 8 }}>Year Wall couldn't open its database.</Text>
        <Text style={{ color: C.mut }}>{error}</Text>
      </View>
    );

  const modal = { presentation: 'modal' as const, contentStyle: { backgroundColor: C.s1 } };
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="week/[w]" options={modal} />
        <Stack.Screen name="plan/[id]" options={modal} />
        <Stack.Screen name="post/[id]" options={modal} />
        <Stack.Screen name="income/[id]" options={modal} />
        <Stack.Screen name="test/[id]" options={modal} />
        <Stack.Screen name="chapter-edit/[id]" options={modal} />
        <Stack.Screen name="habit/[id]" options={modal} />
        <Stack.Screen name="minutes/[hid]" options={modal} />
        <Stack.Screen name="settings" options={modal} />
        <Stack.Screen name="target" options={modal} />
        <Stack.Screen name="share" options={modal} />
        <Stack.Screen name="intro" options={{ ...modal, gestureEnabled: false }} />
      </Stack>
    </>
  );
}
