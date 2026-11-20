import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState, type ColorValue } from 'react-native';
import { commit, S, UI } from '@/data/state';
import { todayS } from '@/utils/dates';
import { C, font } from '@/theme';
import { startTour } from '@/components/tour';
import type { IconName } from '@/components/ui';

const icon = (name: IconName) => ({ color }: { color: ColorValue }) => <Feather name={name} size={22} color={color as string} />;

export default function TabsLayout() {
  // The tour starts once on its own (people who only saw the old intro get it once too).
  useEffect(() => {
    if ((S.meta.settings.tourSeen ?? 0) < 2) {
      const t = setTimeout(startTour, 700);
      return () => clearTimeout(t);
    }
  }, []);

  // Coming back to the app on a new day moves Today forward, unless you were editing an older day.
  useEffect(() => {
    let last = todayS();
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      const t = todayS();
      if (t !== last) {
        if (UI.day === last) UI.day = t;
        last = t;
        commit();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
        tabBarStyle: { backgroundColor: '#0E0D0C', borderTopColor: C.off },
        tabBarActiveTintColor: C.tx,
        tabBarInactiveTintColor: C.mut2,
        tabBarLabelStyle: { fontSize: 11, ...font(600) },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sun') }} />
      <Tabs.Screen name="year" options={{ title: 'Year', tabBarIcon: icon('grid') }} />
      <Tabs.Screen name="chapter" options={{ title: 'Chapter', tabBarIcon: icon('book') }} />
      <Tabs.Screen name="content" options={{ title: 'Content', tabBarIcon: icon('video') }} />
      <Tabs.Screen name="money" options={{ title: 'Money', tabBarIcon: icon('credit-card') }} />
    </Tabs>
  );
}
