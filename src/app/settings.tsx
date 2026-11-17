import Feather from '@expo/vector-icons/Feather';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Banner, Btn, Card, DateField, Field, ModalScreen, Section, T } from '@/components/ui';
import { S } from '@/data/state';
import { actions } from '@/data/store';
import { connect, connectedTo, DEFAULT_SERVER, disconnect, syncNow, useSyncStatus } from '@/data/sync-app';
import { useStore } from '@/hooks/use-store';
import { C } from '@/theme';
import { fmt, todayS } from '@/utils/dates';
import { targetOn } from '@/utils/logic';

async function exportBackup() {
  try {
    const file = new File(Paths.cache, `yearwall-backup-${todayS()}.json`);
    if (file.exists) file.delete();
    file.create();
    file.write(actions.exportJson());
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Year Wall backup', UTI: 'public.json' });
    else Alert.alert('Sharing is not available on this device.');
  } catch (e: any) {
    Alert.alert("Couldn't export the backup", String(e?.message || e));
  }
}

async function importBackup() {
  try {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const text = await new File(res.assets[0].uri).text();
    Alert.alert('Replace everything with this backup?', 'All data on this phone is replaced by the backup. Export first if you want to keep a copy.', [
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
  } catch (e: any) {
    Alert.alert("Couldn't open the file", String(e?.message || e));
  }
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
  const ep = connectedTo();
  const [key, setKey] = useState('');
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const doConnect = async () => {
    setBusy(true);
    setErr('');
    try {
      await connect(server, key);
      setKey('');
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  if (!ep)
    return (
      <>
        <Section left="Sync" right="Off" />
        <T s={13} c={C.mut}>
          Enter your sync key to keep this phone and the web app in step. Data stays on the phone too, so the app keeps working offline.
        </T>
        <Field label="Sync key" value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} placeholder="xxxxx-xxxxx-xxxxx-xxxxx" />
        <Field label="Server" value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        {err ? (
          <T s={13} c={C.danger}>
            {err}
          </T>
        ) : null}
        <Btn label={busy ? 'Connecting...' : 'Connect'} icon="refresh-cw" disabled={busy || !key.trim() || !server.trim()} onPress={doConnect} />
      </>
    );

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
        <T w={600}>{ep.url.replace(/^https?:\/\//, '')}</T>
        <T s={12} c={status.state === 'error' ? C.danger : C.mut}>
          {line}
        </T>
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label="Sync now" kind="ghost" icon="refresh-cw" style={{ flex: 1 }} onPress={() => void syncNow()} />
        <Btn
          label="Disconnect"
          kind="ghost"
          style={{ flex: 1 }}
          onPress={() =>
            Alert.alert('Stop syncing?', 'Your data stays on this phone. Reconnect any time to send what changed.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Disconnect', style: 'destructive', onPress: disconnect },
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
      <Banner>Everything is saved on this phone first, so the app works offline. With sync on, changes also go to your Year Wall server and show up in the web app.</Banner>

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
      <Btn label="Replay the intro" kind="ghost" onPress={() => router.push('/intro')} />
    </ModalScreen>
  );
}
