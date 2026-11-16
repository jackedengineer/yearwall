import Feather from '@expo/vector-icons/Feather';
import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { commit, S, UI } from '@/data/state';
import { todayS } from '@/utils/dates';
import { C, font } from '@/theme';
import type { IconName } from '@/components/ui';

const icon = (name: IconName) => ({ color }: { color: string }) => <Feather name={name} size={22} color={color} />;

export default function TabsLayout() {
  useEffect(() => {
    if (!S.meta.settings.tourDone) {
      const t = setTimeout(() => router.push('/intro'), 400);
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
