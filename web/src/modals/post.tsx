// Web version of src/app/post/[id].tsx (ported from the phone app).
import { router, useLocalSearchParams } from '@web/lib/router';
import { useState } from 'react';
import { View } from '@web/lib/rn';
import { Btn, DateField, Field, Label, ModalScreen, Pills } from '@web/ui';
import { BUCKETS, FORMATS, STATUSES } from '@core/constants';
import { S, uid } from '@core/data/state';
import { actions } from '@core/data/store';
import type { Post } from '@core/data/types';
import { isDate, todayS } from '@core/utils/dates';

export default function PostSheet() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const existing = S.posts.find((p) => p.id === id);
  const [p, setP] = useState<Post>(
    () =>
      existing ?? {
        id: uid('p'),
        title: '',
        bucket: 'Progress',
        format: 'Short',
        platform: 'Reels + Shorts',
        date: date && isDate(date) ? date : todayS(),
        status: 'Planned',
        link: '',
      },
  );
  const set = (patch: Partial<Post>) => setP({ ...p, ...patch });
  const save = () => {
    if (!p.title.trim()) return;
    actions.savePost({ ...p, title: p.title.trim() });
    router.back();
  };

  return (
    <ModalScreen title={existing ? 'Edit post' : 'New post'}>
      <Field label="Title" value={p.title} onChangeText={(v) => set({ title: v })} placeholder="What is the post about?" />
      <DateField label="Date" value={p.date} onChange={(v) => v && set({ date: v })} />
      <View>
        <Label>Bucket</Label>
        <Pills options={BUCKETS} value={p.bucket} onChange={(v) => set({ bucket: v })} />
      </View>
      <View>
        <Label>Format</Label>
        <Pills options={FORMATS} value={p.format} onChange={(v) => set({ format: v })} />
      </View>
      <View>
        <Label>Status</Label>
        <Pills options={STATUSES} value={p.status} onChange={(v) => set({ status: v })} />
      </View>
      <Field label="Platform" value={p.platform} onChangeText={(v) => set({ platform: v })} />
      <Field label="Link, once it's live" value={p.link} onChangeText={(v) => set({ link: v })} placeholder="https://" keyboardType="url" autoCapitalize="none" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label={existing ? 'Save post' : 'Add post'} style={{ flex: 1 }} onPress={save} disabled={!p.title.trim()} />
        {existing ? (
          <Btn
            label="Delete"
            kind="danger"
            onPress={() => {
              actions.deletePost(existing.id);
              router.back();
            }}
          />
        ) : null}
      </View>
    </ModalScreen>
  );
}
