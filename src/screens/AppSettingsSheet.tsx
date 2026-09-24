import React from 'react';
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Controls,
  HomeFeed,
  PRESETS,
  PRESET_ORDER,
  PresetId,
  modeOf,
} from '../controls/controls';
import {
  REELS_WINDOWS_MIN,
  ReelsStatus,
  formatCountdown,
  lockoutMinutes,
} from '../controls/reelsSession';
import {
  DailyLimit,
  LIMIT_OPTIONS_MIN,
  changeLimit,
  formatLimit,
  limitMinutesAt,
} from '../controls/limits';
import { YouTubeControls, YouTubeHome } from '../controls/youtube';
import { SERVICE_INFO, ServiceId } from '../services/services';
import { FocusSettings } from '../storage/settings';
import { AppIcon } from '../ui/AppIcon';
import { formatTimestamp } from '../ui/format';
import {
  ButtonRow,
  CheckRow,
  GroupedSection,
  SwitchRow,
  ValueRow,
} from '../ui/Grouped';
import { useTheme } from '../ui/theme';

const MODES: Record<PresetId, { label: string; detail: string }> = {
  balanced: {
    label: 'Ausgewogen',
    detail:
      'Feed nur von Leuten, denen du folgst. Stories, Nachrichten, Profile.',
  },
  storiesMessages: {
    label: 'Stories + Nachrichten',
    detail: 'Kein Feed. Stories, Nachrichten und Profile bleiben.',
  },
  messages: {
    label: 'Nur Nachrichten',
    detail: 'Nur Direktnachrichten und was dir geschickt wird.',
  },
};

const HOME_FEEDS: { id: HomeFeed; label: string; detail: string }[] = [
  {
    id: 'following',
    label: 'Folge ich',
    detail: 'Nur Accounts, denen du folgst – neueste zuerst.',
  },
  {
    id: 'hidden',
    label: 'Nur Stories',
    detail: 'Stories oben, keine Beiträge.',
  },
  {
    id: 'normal',
    label: 'Für dich',
    detail: 'Instagrams Standard-Feed, gefiltert.',
  },
  { id: 'off', label: 'Aus', detail: 'Focus öffnet direkt die Nachrichten.' },
];

const YOUTUBE_HOMES: { id: YouTubeHome; label: string; detail: string }[] = [
  {
    id: 'subscriptions',
    label: 'Abos',
    detail: 'Neue Videos von Kanälen, die du abonniert hast.',
  },
  {
    id: 'search',
    label: 'Nur Suche',
    detail: 'Kein Feed. Suchen, ansehen, fertig.',
  },
  {
    id: 'normal',
    label: 'YouTube-Startseite',
    detail: 'Empfehlungen von YouTube, ohne Shorts.',
  },
];

/** Asks before a feed block is lifted; the blocks are the point of Focus. */
function confirmUnblock(what: string, onConfirm: () => void) {
  Alert.alert(
    `${what} wirklich erlauben?`,
    `Damit ist der ${what}-Feed in Focus wieder erreichbar – genau das, wovor Focus schützt.`,
    [
      { text: 'Gesperrt lassen', style: 'cancel' },
      { text: 'Erlauben', style: 'destructive', onPress: onConfirm },
    ],
  );
}

type Props = {
  /** The app being edited; null hides the sheet. */
  app: ServiceId | null;
  onClose: () => void;
  settings: FocusSettings;
  onChange: (patch: Partial<FocusSettings>) => void;
  reels: ReelsStatus;
  onStartReels: (minutes: number) => void;
  onEndReels: () => void;
  onReloadInstagram: () => void;
  onOpenInstagramApp: () => void;
  onClearWebsiteData: () => void;
  clearingWebsiteData: boolean;
};

/**
 * One app's settings, as a native page sheet (swipe down to close).
 * Opened from the Focus home by long-pressing an app or in edit mode.
 */
export function AppSettingsSheet({ app, onClose, ...props }: Props) {
  const theme = useTheme();
  // Keep the last app while the sheet animates out.
  const [shown, setShown] = React.useState<ServiceId>(app ?? 'instagram');
  if (app && app !== shown) {
    setShown(app);
  }
  return (
    <Modal
      visible={app !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[styles.sheet, { backgroundColor: theme.groupedBackground }]}
      >
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <AppIcon id={shown} size={30} />
            <Text style={[styles.title, { color: theme.label }]}>
              {SERVICE_INFO[shown].name}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.done, { color: theme.accent }]}>Fertig</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <LimitSection
            limit={props.settings.limits[shown]}
            onChange={limit =>
              props.onChange({
                limits: { ...props.settings.limits, [shown]: limit },
              })
            }
          />
          {shown === 'instagram' ? (
            <InstagramSettings {...props} />
          ) : (
            <YouTubeSettings
              youtube={props.settings.youtube}
              onChange={patch =>
                props.onChange({
                  youtube: { ...props.settings.youtube, ...patch },
                })
              }
            />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Daily limit: less applies now, more (or none) from tomorrow. */
function LimitSection({
  limit,
  onChange,
}: {
  limit: DailyLimit;
  onChange: (limit: DailyLimit) => void;
}) {
  const now = Date.now();
  const today = limitMinutesAt(limit, now);
  const pick = () => {
    const values: (number | null)[] = [null, ...LIMIT_OPTIONS_MIN];
    const options = values.map(formatLimit);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Tageslimit',
        message:
          'Weniger gilt sofort. Mehr Zeit oder „Aus“ gilt erst ab morgen.',
        options: [...options, 'Abbrechen'],
        cancelButtonIndex: options.length,
      },
      index => {
        if (index < values.length) {
          onChange(changeLimit(limit, values[index], Date.now()));
        }
      },
    );
  };
  return (
    <GroupedSection
      title="Tageslimit"
      footer="Ist die Zeit um, bleibt die App bis morgen zu. Weniger gilt sofort, mehr Zeit oder „Aus“ erst ab morgen."
    >
      <ValueRow
        label="Pro Tag"
        detail={
          limit.next
            ? `Ab morgen: ${formatLimit(limit.next.minutes)}`
            : undefined
        }
        value={formatLimit(today)}
        onPress={pick}
      />
    </GroupedSection>
  );
}

function InstagramSettings({
  settings,
  onChange,
  reels,
  onStartReels,
  onEndReels,
  onReloadInstagram,
  onOpenInstagramApp,
  onClearWebsiteData,
  clearingWebsiteData,
}: Omit<Props, 'app' | 'onClose'>) {
  const theme = useTheme();
  const controls = settings.controls;
  const mode = modeOf(controls);
  const setControls = (patch: Partial<Controls>) =>
    onChange({ controls: { ...controls, ...patch } });

  const confirmReels = (minutes: number) => {
    const lockout = lockoutMinutes(minutes);
    Alert.alert(
      `Reels für ${minutes} Minuten?`,
      `Danach stoppen Reels sofort und sind ${lockout} Minuten gesperrt. Verlängern geht nicht.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Starten', onPress: () => onStartReels(minutes) },
      ],
    );
  };

  return (
    <>
      {controls.blockReels ? (
        <GroupedSection
          title="Reels-Zeitfenster"
          footer="Nicht verlängerbar. Danach sind Reels mindestens 5 Minuten gesperrt – so lange wie das Zeitfenster."
        >
          {reels.state === 'active' ? (
            <ValueRow
              label="Reels offen"
              value={`noch ${formatCountdown(reels.remainingMs)}`}
              valueColor={theme.accent}
            />
          ) : null}
          {reels.state === 'active' ? (
            <ButtonRow label="Jetzt beenden" onPress={onEndReels} destructive />
          ) : null}
          {reels.state === 'locked' ? (
            <ValueRow
              label="Gesperrt bis"
              value={formatTimestamp(reels.until)}
            />
          ) : null}
          {reels.state === 'idle'
            ? REELS_WINDOWS_MIN.map(minutes => (
                <ButtonRow
                  key={minutes}
                  label={`Reels für ${minutes} Minuten`}
                  onPress={() => confirmReels(minutes)}
                />
              ))
            : null}
        </GroupedSection>
      ) : null}

      <GroupedSection
        title="Modus"
        footer={
          mode === 'custom'
            ? 'Eigene Einstellung – wähle einen Modus, um zurückzusetzen.'
            : undefined
        }
      >
        {PRESET_ORDER.map(id => (
          <CheckRow
            key={id}
            label={MODES[id].label}
            detail={MODES[id].detail}
            checked={mode === id}
            onPress={() => onChange({ controls: PRESETS[id] })}
          />
        ))}
        {mode === 'custom' ? (
          <CheckRow
            label="Eigene"
            detail="Du hast einzelne Schalter unten angepasst."
            checked
            onPress={() => {}}
          />
        ) : null}
      </GroupedSection>

      <GroupedSection title="Startseite">
        {HOME_FEEDS.map(feed => (
          <CheckRow
            key={feed.id}
            label={feed.label}
            detail={feed.detail}
            checked={controls.homeFeed === feed.id}
            onPress={() => setControls({ homeFeed: feed.id })}
          />
        ))}
      </GroupedSection>

      <GroupedSection
        title="Inhalte"
        footer="Werbung und Vorschläge verschwinden nur bei eindeutiger Kennzeichnung – lieber einmal Werbung als ein fehlender Beitrag von Freunden."
      >
        <SwitchRow
          label="Reels sperren"
          value={controls.blockReels}
          onValueChange={value =>
            value
              ? setControls({ blockReels: true })
              : confirmUnblock('Reels', () =>
                  setControls({ blockReels: false }),
                )
          }
        />
        <SwitchRow
          label="Explore sperren"
          value={controls.blockExplore}
          onValueChange={value =>
            value
              ? setControls({ blockExplore: true })
              : confirmUnblock('Explore', () =>
                  setControls({ blockExplore: false }),
                )
          }
        />
        <SwitchRow
          label="Stories sperren"
          value={controls.blockStories}
          onValueChange={value => setControls({ blockStories: value })}
        />
        <SwitchRow
          label="Gespeichert sperren"
          value={controls.blockSaved}
          onValueChange={value => setControls({ blockSaved: value })}
        />
        <SwitchRow
          label="Werbung ausblenden"
          value={controls.hideSponsored}
          onValueChange={value => setControls({ hideSponsored: value })}
        />
        <SwitchRow
          label="Vorschläge ausblenden"
          value={controls.hideSuggested}
          onValueChange={value => setControls({ hideSuggested: value })}
        />
      </GroupedSection>

      <GroupedSection footer="Kamera, Filter und manche Posting-Funktionen gibt es nur in der offiziellen App.">
        <ButtonRow label="Instagram neu laden" onPress={onReloadInstagram} />
        <ButtonRow
          label="Zum Posten: Instagram-App öffnen"
          onPress={onOpenInstagramApp}
        />
      </GroupedSection>

      <GroupedSection>
        <ButtonRow
          label="Instagram-Websitedaten löschen"
          detail="Löscht Cookies, Cache und Login. Du musst dich neu anmelden."
          onPress={onClearWebsiteData}
          busy={clearingWebsiteData}
          destructive
        />
      </GroupedSection>
    </>
  );
}

function YouTubeSettings({
  youtube,
  onChange,
}: {
  youtube: YouTubeControls;
  onChange: (patch: Partial<YouTubeControls>) => void;
}) {
  return (
    <>
      <GroupedSection
        title="Start"
        footer="Ohne Startseite gibt es keine Empfehlungs-Endlosliste – nur das, was du abonniert hast oder suchst."
      >
        {YOUTUBE_HOMES.map(home => (
          <CheckRow
            key={home.id}
            label={home.label}
            detail={home.detail}
            checked={youtube.home === home.id}
            onPress={() => onChange({ home: home.id })}
          />
        ))}
      </GroupedSection>
      <GroupedSection
        title="Inhalte"
        footer="Trends, Erkunden und Gaming sind immer gesperrt."
      >
        <SwitchRow
          label="Shorts sperren"
          value={youtube.blockShorts}
          onValueChange={value =>
            value
              ? onChange({ blockShorts: true })
              : confirmUnblock('Shorts', () => onChange({ blockShorts: false }))
          }
        />
        <SwitchRow
          label="Empfehlungen unter Videos ausblenden"
          detail="Kein „Als Nächstes“ – nach dem Video ist Schluss."
          value={youtube.hideRelated}
          onValueChange={value => onChange({ hideRelated: value })}
        />
        <SwitchRow
          label="Kommentare ausblenden"
          value={youtube.hideComments}
          onValueChange={value => onChange({ hideComments: value })}
        />
      </GroupedSection>
    </>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  done: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    paddingTop: 6,
    paddingBottom: 40,
  },
});
