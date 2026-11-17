import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Btn, ModalScreen, T } from '@/components/ui';
import { actions } from '@/data/store';
import { C } from '@/theme';

const STEPS = [
  ['Your whole year on one wall', 'The year runs from Week 1 (Nov 16) to Week 52. Every week is a card, and every day is a bar that lights up as you finish your habits.'],
  ['Today is where you start', "Open the app each morning and night. Tap to log minutes or tick a habit, then write tonight's log. Tap the mic on your keyboard to speak it instead."],
  ['The Year board', 'Tap any week to set its focus, add plans, tick habits or write notes. A week where every habit hits its target turns green and counts as a perfect week.'],
  ['Chapters and finish lines', 'Each chapter has phases and the tests you take on Day 0 and at the end. Add your Day 0 numbers on the Chapter tab.'],
  ['Your data, on your phone first', 'Everything is saved on this phone and works without internet. Turn on sync in Settings to see the same data in the web app. Export a backup now and then.'],
];

export default function Intro() {
  const [i, setI] = useState(0);
  const done = () => {
    actions.saveSettings({ tourDone: true });
    router.back();
  };
  return (
    <ModalScreen title="Welcome to Year Wall">
      <View style={{ gap: 12, paddingTop: 8 }}>
        <T w={600} s={12} c={C.mut}>
          {i + 1} of {STEPS.length}
        </T>
        <T w={700} s={22} style={{ lineHeight: 28 }}>
          {STEPS[i][0]}
        </T>
        <T s={15} c={C.tx2} style={{ lineHeight: 23 }}>
          {STEPS[i][1]}
        </T>
        <View style={{ flexDirection: 'row', gap: 4, marginVertical: 8 }}>
          {STEPS.map((_, k) => (
            <View key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: k === i ? C.lit : C.line3 }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn label={i ? 'Back' : 'Skip'} kind="ghost" style={{ flex: 1 }} onPress={() => (i ? setI(i - 1) : done())} />
          <Btn label={i < STEPS.length - 1 ? 'Next' : 'Start'} style={{ flex: 1 }} onPress={() => (i < STEPS.length - 1 ? setI(i + 1) : done())} />
        </View>
      </View>
    </ModalScreen>
  );
}
