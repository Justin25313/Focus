import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INSTAGRAM_RULE_VERSION } from '../filtering/instagram/routes';
import { Diagnostics } from '../storage/diagnostics';
import { FocusSettings } from '../storage/settings';
import { ButtonRow, GroupedSection, SwitchRow, ValueRow } from '../ui/Grouped';
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
};

const REASON_LABEL = {
  reels: 'Reels',
  sharedReel: 'Einzelnes Reel',
  explore: 'Explore',
} as const;

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
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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

        <GroupedSection
          title="Schutz"
          footer="In dieser Version immer aktiv. Voreinstellungen wie „Nur Nachrichten“ und „Stories + Nachrichten“ folgen."
        >
          <ValueRow label="Reels-Feed" value="Gesperrt" />
          <ValueRow label="Explore" value="Gesperrt" />
          <ValueRow label="Einzelne Reels" value="Gesperrt" />
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

        <GroupedSection title="Daten">
          <ButtonRow
            label="Instagram-Websitedaten löschen"
            detail="Löscht Cookies, Cache und Login. Du musst dich neu anmelden."
            onPress={onClearWebsiteData}
            busy={clearingWebsiteData}
            destructive
          />
          <ButtonRow
            label="Focus-Einstellungen zurücksetzen"
            onPress={onResetSettings}
            destructive
          />
        </GroupedSection>

        <Text style={[styles.about, { color: theme.tertiaryLabel }]}>
          Focus 0.1 · Kein Konto, keine Cloud, kein Tracking.{'\n'}
          Deine Einstellungen bleiben auf diesem iPhone.
        </Text>
      </ScrollView>
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
