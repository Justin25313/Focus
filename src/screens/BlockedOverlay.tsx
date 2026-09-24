import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlockReason } from '../filtering/instagram/routes';
import { formatTimestamp } from '../ui/format';
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
  feed: {
    title: 'Der Feed ist aus',
    body: 'In diesem Modus gibt es nur Nachrichten. Den Modus änderst du im Focus-Tab.',
  },
  stories: {
    title: 'Stories sind aus',
    body: 'Stories hast du in Focus ausgeschaltet. Den Modus änderst du im Focus-Tab.',
  },
  saved: {
    title: 'Gespeichert ist aus',
    body: 'Gespeicherte Beiträge sind in Focus ausgeschaltet – sie werden schnell zur eigenen Endlosliste.',
  },
};

export function BlockedOverlay({
  reason,
  lockedUntil,
  onBack,
  onSearch,
  onOpenNative,
}: {
  reason: BlockReason;
  /** Set right after a timed Reels window: Reels are locked until then. */
  lockedUntil?: number;
  onBack: () => void;
  onSearch: () => void;
  onOpenNative: () => void;
}) {
  const theme = useTheme();
  const timeUp =
    lockedUntil !== undefined &&
    (reason === 'reels' || reason === 'sharedReel');
  const copy = timeUp
    ? {
        title: 'Reels-Zeit ist um',
        body: `Reels sind jetzt gesperrt – wieder möglich ab ${formatTimestamp(
          lockedUntil,
        )}. Ein guter Moment, das Handy wegzulegen.`,
      }
    : COPY[reason];
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
        {reason === 'sharedReel' && !timeUp ? (
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
