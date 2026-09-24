import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BlockReason,
  INSTAGRAM_RULE_VERSION,
} from '../filtering/instagram/routes';
import {
  Controls,
  HomeFeed,
  PRESETS,
  PRESET_ORDER,
  PresetId,
  modeOf,
} from '../controls/controls';
import { Diagnostics } from '../storage/diagnostics';
import { UsageLog } from '../usage/usage';
import { AboutScreen } from './AboutScreen';
import { UsageCard } from './UsageCard';
import { FocusSettings } from '../storage/settings';
import {
  ButtonRow,
  CheckRow,
  GroupedSection,
  SwitchRow,
  ValueRow,
} from '../ui/Grouped';
import { formatTimestamp } from '../ui/format';
import { TAB_BAR_HEIGHT, useTheme } from '../ui/theme';

export type FilterHealth = 'starting' | 'active' | 'noResponse';

type Props = {
  settings: FocusSettings;
  onChange: (patch: Partial<FocusSettings>) => void;
  health: FilterHealth;
  diagnostics: Diagnostics;
  clearingWebsiteData: boolean;
  onReload: () => void;
  onOpenInstagramApp: () => void;
  onClearWebsiteData: () => void;
  onResetSettings: () => void;
  onResetDiagnostics: () => void;
  usageLog: UsageLog;
  onResetUsage: () => void;
};

const REASON_LABEL: Record<BlockReason, string> = {
  reels: 'Reels',
  sharedReel: 'Einzelnes Reel',
  explore: 'Explore',
  feed: 'Feed',
  stories: 'Stories',
  saved: 'Gespeichert',
};

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

export function SettingsScreen({
  settings,
  onChange,
  health,
  diagnostics,
  clearingWebsiteData,
  onReload,
  onOpenInstagramApp,
  onClearWebsiteData,
  onResetSettings,
  onResetDiagnostics,
  usageLog,
  onResetUsage,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [showAbout, setShowAbout] = useState(false);

  const controls = settings.controls;
  const mode = modeOf(controls);
  const setControls = (patch: Partial<Controls>) =>
    onChange({ controls: { ...controls, ...patch } });

  // Discovery blocks are the point of Focus; switching them off is allowed
  // but deliberate.
  const setDiscoveryBlock = (
    key: 'blockReels' | 'blockExplore',
    value: boolean,
  ) => {
    if (value) {
      setControls({ [key]: true });
      return;
    }
    const what = key === 'blockReels' ? 'Reels' : 'Explore';
    Alert.alert(
      `${what} wirklich erlauben?`,
      `Damit ist der ${what}-Feed in Focus wieder erreichbar – genau das, wovor Focus schützt.`,
      [
        { text: 'Gesperrt lassen', style: 'cancel' },
        {
          text: 'Erlauben',
          style: 'destructive',
          onPress: () => setControls({ [key]: false }),
        },
      ],
    );
  };

  const healthLabel =
    health === 'active'
      ? 'Aktiv'
      : health === 'starting'
      ? 'Wartet auf Instagram'
      : 'Keine Rückmeldung';
  const healthColor =
    health === 'active'
      ? theme.accent
      : health === 'noResponse'
      ? theme.destructive
      : undefined;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.groupedBackground }]}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
        }}
      >
        <Text style={[styles.largeTitle, { color: theme.label }]}>Focus</Text>
        <Text style={[styles.subtitle, { color: theme.secondaryLabel }]}>
          Instagram-Steuerung
        </Text>

        {settings.trackUsage ? (
          <UsageCard log={usageLog} now={Date.now()} />
        ) : null}

        <GroupedSection
          title="Modus"
          footer={
            mode === 'custom'
              ? 'Eigene Einstellung – wähle einen Modus, um zurückzusetzen.'
              : 'Änderungen gelten sofort, ohne Instagram neu zu laden.'
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
            onValueChange={value => setDiscoveryBlock('blockReels', value)}
          />
          <SwitchRow
            label="Explore sperren"
            value={controls.blockExplore}
            onValueChange={value => setDiscoveryBlock('blockExplore', value)}
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

        <GroupedSection title="Darstellung">
          <SwitchRow
            label="Graustufen"
            detail="Instagram ohne Farbe ist spürbar weniger fesselnd."
            value={settings.grayscale}
            onValueChange={value => onChange({ grayscale: value })}
          />
        </GroupedSection>

        <GroupedSection title="Verhalten">
          <SwitchRow
            label="Instagram beim Start öffnen"
            detail="Focus antippen – und du bist sofort in Instagram."
            value={settings.openInstagramOnLaunch}
            onValueChange={value => onChange({ openInstagramOnLaunch: value })}
          />
          <SwitchRow
            label="Letzten Ort merken"
            detail="Nach einem Neustart geht es dort weiter, wo du warst – nie bei Reels oder Explore."
            value={settings.keepLastLocation}
            onValueChange={value => onChange({ keepLastLocation: value })}
          />
          <SwitchRow
            label="Nutzungszeit zählen"
            detail="Nur Zeit mit Instagram im Vordergrund. Bleibt auf diesem iPhone."
            value={settings.trackUsage}
            onValueChange={value => onChange({ trackUsage: value })}
          />
        </GroupedSection>

        <GroupedSection
          title="Instagram"
          footer="Manches (Kamera, Filter, bestimmte Posting-Funktionen) gibt es nur in der offiziellen App. Öffne sie dafür gezielt – und danach wieder Focus."
        >
          <ButtonRow label="Seite neu laden" onPress={onReload} />
          <ButtonRow
            label="Zum Posten: Instagram-App öffnen"
            onPress={onOpenInstagramApp}
          />
        </GroupedSection>

        <GroupedSection
          title="Filterstatus"
          footer="Diagnosedaten bleiben ausschließlich auf diesem iPhone."
        >
          <ValueRow
            label="Status"
            value={healthLabel}
            valueColor={healthColor}
          />
          <ValueRow
            label="Letzte Prüfung"
            value={
              diagnostics.lastFilterReadyAt
                ? formatTimestamp(diagnostics.lastFilterReadyAt)
                : '–'
            }
          />
          <ValueRow
            label="Instagram-Regeln"
            value={`v${INSTAGRAM_RULE_VERSION}`}
          />
          <ValueRow
            label="Gesperrte Aufrufe"
            value={String(diagnostics.blockedCount)}
          />
          <ValueRow
            label="Ausgeblendet"
            value={`${diagnostics.hiddenSponsored} Werbung · ${diagnostics.hiddenSuggested} Vorschläge`}
          />
          {diagnostics.lastBlocked ? (
            <ValueRow
              label="Zuletzt gesperrt"
              value={`${
                REASON_LABEL[diagnostics.lastBlocked.reason]
              } · ${formatTimestamp(diagnostics.lastBlocked.at)}`}
            />
          ) : null}
          {diagnostics.lastUnknownRoute ? (
            <ValueRow
              label="Unbekannte Route"
              value={diagnostics.lastUnknownRoute.path}
            />
          ) : null}
          {diagnostics.lastError ? (
            <ValueRow
              label="Letzter Fehler"
              value={`${diagnostics.lastError.code} · ${formatTimestamp(
                diagnostics.lastError.at,
              )}`}
            />
          ) : null}
          {diagnostics.webProcessRestarts > 0 ? (
            <ValueRow
              label="WebView-Neustarts"
              value={String(diagnostics.webProcessRestarts)}
            />
          ) : null}
          <ButtonRow
            label="Diagnose zurücksetzen"
            onPress={onResetDiagnostics}
          />
        </GroupedSection>

        <GroupedSection>
          <ButtonRow
            label="Datenschutz & Grenzen"
            onPress={() => setShowAbout(true)}
            chevron
          />
        </GroupedSection>

        <GroupedSection title="Daten">
          <ButtonRow
            label="Instagram-Websitedaten löschen"
            detail="Löscht Cookies, Cache und Login. Du musst dich neu anmelden."
            onPress={onClearWebsiteData}
            busy={clearingWebsiteData}
            destructive
          />
          <ButtonRow
            label="Nutzungszeit zurücksetzen"
            onPress={onResetUsage}
            destructive
          />
          <ButtonRow
            label="Focus-Einstellungen zurücksetzen"
            onPress={onResetSettings}
            destructive
          />
        </GroupedSection>

        <Text style={[styles.about, { color: theme.tertiaryLabel }]}>
          Focus 0.3 · Kein Konto, keine Cloud, kein Tracking.{'\n'}
          Deine Einstellungen bleiben auf diesem iPhone.
        </Text>
      </ScrollView>
      {showAbout ? <AboutScreen onBack={() => setShowAbout(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
  },
  largeTitle: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginHorizontal: 20,
  },
  subtitle: {
    fontSize: 15,
    marginHorizontal: 20,
    marginTop: 2,
    marginBottom: 22,
  },
  about: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginHorizontal: 32,
  },
});
