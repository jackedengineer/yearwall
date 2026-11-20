// Web version of src/app/settings.tsx (ported from the phone app).
import Feather from '@web/lib/icons';
import { router } from '@web/lib/router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from '@web/lib/rn';
import { Banner, Btn, Card, DateField, Field, ModalScreen, Section, T } from '@web/ui';
import { S } from '@core/data/state';
import { actions } from '@core/data/store';
import { signOut, syncNow, useSyncStatus } from '@web/data/sync-web';
import { startTour } from '@web/components/tour';
import { useStore } from '@web/lib/use-store';
import { C } from '@web/lib/theme';
import { fmt, todayS } from '@core/utils/dates';
import { targetOn } from '@core/utils/logic';

/** Saves the backup as a .json file through the browser's download. */
function exportBackup() {
  const blob = new Blob([actions.exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yearwall-backup-${todayS()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json,text/plain';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    Alert.alert('Replace everything with this backup?', 'All your data is replaced by the backup, on the web and on your phone (through sync). Export first if you want to keep a copy.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Replace',
        style: 'destructive',
        onPress: () => {
          try {
            actions.importJson(text);
            Alert.alert('Backup imported.');
          } catch {
            Alert.alert("That file isn't a Year Wall backup.");
          }
        },
      },
    ]);
  };
  input.click();
}

function ago(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

function SyncSection() {
  const status = useSyncStatus();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);
  const line =
    status.state === 'error'
      ? status.message
      : status.state === 'offline'
        ? `${status.message}${status.pending ? `, ${status.pending} changes waiting` : ''}`
        : status.state === 'syncing'
          ? 'Syncing...'
          : status.lastSync
            ? `Up to date, synced ${ago(status.lastSync)}`
            : 'Waiting for the first sync';
  return (
    <>
      <Section left="Sync" right="On" />
      <Card style={{ padding: 14, gap: 4 }}>
        <T w={600}>{location.host}</T>
        <T s={12} c={status.state === 'error' ? C.danger : C.mut}>
          {line}
        </T>
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Sync now" kind="ghost" icon="refresh-cw" style={{ flex: 1 }} onPress={() => void syncNow()} />
        <Btn
          label="Sign out"
          kind="ghost"
          icon="log-out"
          style={{ flex: 1 }}
          onPress={() =>
            Alert.alert('Sign out of this browser?', 'Your data stays on the server and your phone. You need the sync key to sign in again.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: signOut },
            ])
          }
        />
      </View>
    </>
  );
}

export default function SettingsSheet() {
  useStore();
  const st = S.meta.settings;
  const t = todayS();
  const [cur, setCur] = useState(st.currency);
  const [posts, setPosts] = useState(String(st.weeklyPostTarget));

  return (
    <ModalScreen title="Settings">
      <Banner>Your data lives on your Year Wall server and on your phone. Changes made here reach the phone app within a few seconds.</Banner>

      <SyncSection />

      <Section left="Habits" />
      <Card>
        {S.meta.habits.map((h, i) => {
          const ended = h.activeTo && h.activeTo < t;
          const ref = t < h.activeFrom ? h.activeFrom : t;
          const desc = [
            h.type === 'minutes' ? `${targetOn(h, ref)} min a day` : 'Check',
            (h.daysPerWeek || 7) < 7 ? `${h.daysPerWeek} days a week` : '',
            ended ? `ended ${fmt(h.activeTo!)}` : t < h.activeFrom ? `starts ${fmt(h.activeFrom)}` : '',
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <Pressable
              key={h.id}
              onPress={() => router.push({ pathname: '/habit/[id]', params: { id: h.id } })}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: C.line2 }, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <T w={600}>{h.name}</T>
                <T s={12} c={C.mut}>
                  {desc}
                </T>
              </View>
              <Feather name="chevron-right" size={18} color={C.mut} />
            </Pressable>
          );
        })}
      </Card>
      <Btn label="Add a habit" kind="ghost" onPress={() => router.push({ pathname: '/habit/[id]', params: { id: 'new' } })} />

      <Section left="Preferences" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Currency symbol"
            value={cur}
            maxLength={4}
            onChangeText={setCur}
            onEndEditing={() => actions.saveSettings({ currency: cur.trim() || '₹' })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Posts per week target"
            value={posts}
            keyboardType="number-pad"
            onChangeText={setPosts}
            onEndEditing={() => actions.saveSettings({ weeklyPostTarget: Math.max(1, Number(posts) || 4) })}
          />
        </View>
      </View>
      <DateField label="Day 0" value={st.day0} onChange={(v) => v && actions.saveSettings({ day0: v })} />

      <Section left="Your data" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Export backup" kind="ghost" icon="upload" style={{ flex: 1 }} onPress={exportBackup} />
        <Btn label="Import backup" kind="ghost" icon="download" style={{ flex: 1 }} onPress={importBackup} />
      </View>
      <Btn
        label="Replay the tour"
        kind="ghost"
        onPress={() => {
          router.back();
          setTimeout(startTour, 50);
        }}
      />
    </ModalScreen>
  );
}
