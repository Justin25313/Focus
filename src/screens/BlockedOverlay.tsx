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
    body: 'Der Reels-Feed ist in Unscroll gesperrt, damit aus einem Video nicht zwanzig werden.',
  },
  sharedReel: {
    title: 'Nur dieses eine Reel',
    body: 'Ein Reel, das dir jemand schickt, kannst du ansehen – weiterwischen geht nur in einem Reels-Zeitfenster.',
  },
  explore: {
    title: 'Explore ist aus',
    body: 'Algorithmische Vorschläge bleiben draußen. Suchst du jemand Bestimmtes? Die Unscroll-Suche findet Profile direkt.',
  },
  feed: {
    title: 'Der Feed ist aus',
    body: 'In diesem Modus gibt es nur Nachrichten. Den Modus änderst du über die Instagram-Karte auf dem Startbildschirm.',
  },
  stories: {
    title: 'Stories sind aus',
    body: 'Stories hast du in Unscroll ausgeschaltet. Den Modus änderst du über die Instagram-Karte auf dem Startbildschirm.',
  },
  saved: {
    title: 'Gespeichert ist aus',
    body: 'Gespeicherte Beiträge sind in Unscroll ausgeschaltet – sie werden schnell zur eigenen Endlosliste.',
  },
  shorts: {
    title: 'Shorts sind aus',
    body: 'Shorts ziehen dich von einem Video ins nächste. Wenn du willst, öffne sie bewusst für ein paar Minuten – lange drücken auf YouTube im Unscroll-Menü.',
  },
  ytHome: {
    title: 'Was willst du sehen?',
    body: 'Die YouTube-Startseite mit Empfehlungen ist aus. Such gezielt nach einem Video oder Kanal.',
  },
  ytSubs: {
    title: 'Nur Suche',
    body: 'In diesem Modus gibt es kein Abo-Feed – nur gezielte Suche. Den Modus änderst du über die YouTube-Karte auf dem Startbildschirm.',
  },
  ytExplore: {
    title: 'Trends sind aus',
    body: 'Trends, Erkunden und Gaming sind algorithmische Endlos-Listen und bleiben gesperrt.',
  },
  xExplore: {
    title: 'Erkunden ist aus',
    body: 'Trends und der Erkunden-Feed von X sind algorithmische Endlos-Listen. Such gezielt nach Posts oder Accounts.',
  },
  rHome: {
    title: 'Die Reddit-Startseite ist aus',
    body: 'Sie mischt Empfehlungen unter deine Communities. Öffne eine Community gezielt, such danach – oder schalte sie im Reddit-Menü ein (lange drücken).',
  },
  rPopular: {
    title: 'Popular ist aus',
    body: 'Popular, All und Erkunden sind Reddits Endlos-Feeds. Deine Communities erreichst du über die Unscroll-Suche.',
  },
};

/** Blocks where a deliberate search is the better way to what you want. */
const SEARCHABLE: BlockReason[] = [
  'ytHome',
  'ytSubs',
  'xExplore',
  'rHome',
  'rPopular',
];

export function BlockedOverlay({
  reason,
  lockedUntil,
  onBack,
  onSearch,
}: {
  reason: BlockReason;
  /** Set after a timed Reels (Shorts) window: locked until then. */
  lockedUntil?: number;
  onBack: () => void;
  onSearch: () => void;
}) {
  const theme = useTheme();
  const kind =
    reason === 'shorts'
      ? 'Shorts'
      : reason === 'reels' || reason === 'sharedReel'
      ? 'Reels'
      : null;
  const timeUp = lockedUntil !== undefined && kind !== null;
  const copy = timeUp
    ? {
        title: `${kind}-Zeit ist um`,
        body: `${kind} sind jetzt gesperrt – wieder möglich ab ${formatTimestamp(
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
        {SEARCHABLE.includes(reason) ? (
          <PrimaryButton title="Suchen" onPress={onSearch} />
        ) : null}
        <PrimaryButton
          title="Zurück"
          onPress={onBack}
          secondary={reason === 'explore' || SEARCHABLE.includes(reason)}
        />
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
