import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Controls,
  PRESETS,
  PRESET_ORDER,
  PresetId,
} from '../controls/controls';
import { CheckRow, GroupedSection } from '../ui/Grouped';
import { FocusIcon } from '../ui/icons';
import { PrimaryButton } from '../ui/PrimaryButton';
import { useTheme } from '../ui/theme';

const POINTS: { title: string; body: string }[] = [
  {
    title: 'Was bleibt',
    body: 'Nachrichten, Profile, Stories und Beiträge von Leuten, denen du folgst.',
  },
  {
    title: 'Was draußen bleibt',
    body: 'Reels-Feed und Explore. Kein Video zieht dich ins nächste.',
  },
  {
    title: 'Nur auf deinem iPhone',
    body: 'Kein Konto, keine Cloud, kein Tracking. Dein Instagram-Login bleibt bei Instagram.',
  },
];

const MODE_LABELS: Record<PresetId, { label: string; detail: string }> = {
  balanced: {
    label: 'Ausgewogen',
    detail: 'Feed nur von Leuten, denen du folgst.',
  },
  storiesMessages: {
    label: 'Stories + Nachrichten',
    detail: 'Kein Feed, nur Stories und DMs.',
  },
  messages: { label: 'Nur Nachrichten', detail: 'Nur Direktnachrichten.' },
};

export function OnboardingScreen({
  onContinue,
}: {
  onContinue: (controls: Controls) => void;
}) {
  const theme = useTheme();
  const [preset, setPreset] = useState<PresetId>('balanced');
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={[styles.mark, { backgroundColor: theme.accent }]}>
          <FocusIcon color={theme.onAccent} size={44} />
        </View>
        <Text style={[styles.title, { color: theme.label }]}>Focus</Text>
        <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>
          Instagram ohne Reels, Explore und algorithmischen Ballast.
        </Text>

        <View style={styles.points}>
          {POINTS.map(point => (
            <View key={point.title} style={styles.point}>
              <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              <View style={styles.pointText}>
                <Text style={[styles.pointTitle, { color: theme.label }]}>
                  {point.title}
                </Text>
                <Text
                  style={[styles.pointBody, { color: theme.secondaryLabel }]}
                >
                  {point.body}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.modeTitle, { color: theme.label }]}>
          Wähle deinen Modus
        </Text>
        <View style={styles.modes}>
          <GroupedSection footer="Jederzeit änderbar im Focus-Tab.">
            {PRESET_ORDER.map(id => (
              <CheckRow
                key={id}
                label={MODE_LABELS[id].label}
                detail={MODE_LABELS[id].detail}
                checked={preset === id}
                onPress={() => setPreset(id)}
              />
            ))}
          </GroupedSection>
        </View>

        <Text style={[styles.tip, { color: theme.secondaryLabel }]}>
          Tipp: Leg Focus auf den Platz der Instagram-App und verschiebe
          Instagram in die App-Mediathek.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton
          title="Instagram öffnen"
          onPress={() => onContinue(PRESETS[preset])}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  mark: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 19,
    lineHeight: 25,
    marginTop: 8,
  },
  points: {
    marginTop: 40,
    gap: 24,
  },
  point: {
    flexDirection: 'row',
    gap: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  pointText: {
    flex: 1,
    gap: 3,
  },
  pointTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  pointBody: {
    fontSize: 15,
    lineHeight: 21,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 36,
    marginBottom: 12,
  },
  modes: {
    marginHorizontal: -32,
  },
  tip: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 24,
  },
});
