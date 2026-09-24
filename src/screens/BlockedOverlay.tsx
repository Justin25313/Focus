import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlockReason } from '../filtering/instagram/routes';
import { ShieldIcon } from '../ui/icons';
import { PrimaryButton } from '../ui/PrimaryButton';
import { useTheme } from '../ui/theme';

const COPY: Record<BlockReason, { title: string; body: string }> = {
  reels: {
    title: 'Reels sind aus',
    body: 'Der Reels-Feed ist in Focus gesperrt, damit aus einem Video nicht zwanzig werden.',
  },
  sharedReel: {
    title: 'Einzelne Reels folgen später',
    body: 'Focus kann noch nicht garantieren, dass nach einem geteilten Reel Schluss ist. Deshalb bleibt es vorerst gesperrt.',
  },
  explore: {
    title: 'Explore ist aus',
    body: 'Algorithmische Vorschläge bleiben draußen. Suchst du jemand Bestimmtes? Die Focus-Suche findet Profile direkt.',
  },
};

export function BlockedOverlay({
  reason,
  onBack,
  onSearch,
  onOpenNative,
}: {
  reason: BlockReason;
  onBack: () => void;
  onSearch: () => void;
  onOpenNative: () => void;
}) {
  const theme = useTheme();
  const copy = COPY[reason];
  return (
    <View
      style={[styles.container, { backgroundColor: theme.background }]}
      accessibilityViewIsModal
    >
      <View style={styles.content}>
        <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
          <ShieldIcon color={theme.accent} size={44} />
        </View>
        <Text style={[styles.title, { color: theme.label }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: theme.secondaryLabel }]}>
          {copy.body}
        </Text>
      </View>
      <View style={styles.actions}>
        {reason === 'explore' ? (
          <PrimaryButton title="Profil suchen" onPress={onSearch} />
        ) : null}
        <PrimaryButton
          title="Zurück"
          onPress={onBack}
          secondary={reason === 'explore'}
        />
        {reason === 'sharedReel' ? (
          <PrimaryButton
            title="Einmal in der Instagram-App öffnen"
            onPress={onOpenNative}
            secondary
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: 28,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 14,
    marginBottom: 36,
  },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 330,
  },
  actions: {
    gap: 10,
  },
});
