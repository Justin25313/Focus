import React, { useState } from 'react';
import {
  ActionSheetIOS,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WindowStatus, formatCountdown } from '../controls/timeWindow';
import { SERVICE_IDS, SERVICE_INFO, ServiceId } from '../services/services';
import { Diagnostics } from '../storage/diagnostics';
import {
  FocusSettings,
  PAUSE_OPTIONS_S,
  PauseSeconds,
} from '../storage/settings';
import { AppIcon } from '../ui/AppIcon';
import { ButtonRow, GroupedSection, SwitchRow, ValueRow } from '../ui/Grouped';
import { PencilIcon } from '../ui/icons';
import { tabBarSpace, useTheme } from '../ui/theme';
import { UsageLog } from '../usage/usage';
import { AboutScreen } from './AboutScreen';
import { AppSettingsSheet } from './AppSettingsSheet';
import { FilterHealth, StatusScreen } from './StatusScreen';
import { UsageCard } from './UsageCard';

export type { FilterHealth } from './StatusScreen';

type Props = {
  settings: FocusSettings;
  onChange: (patch: Partial<FocusSettings>) => void;
  onOpenApp: (id: ServiceId) => void;
  /** Short status under an app icon, e.g. the time left today. */
  appBadges: Partial<Record<ServiceId, string>>;
  health: FilterHealth;
  diagnostics: Diagnostics;
  clearingWebsiteData: boolean;
  onRestartApp: (id: ServiceId) => void;
  onOpenInstagramApp: () => void;
  onLogoutApp: (id: ServiceId) => void;
  onResetSettings: () => void;
  onResetDiagnostics: () => void;
  usageLog: UsageLog;
  onResetUsage: () => void;
  reels: WindowStatus;
  onStartReels: (minutes: number) => void;
  onEndReels: () => void;
  shorts: WindowStatus;
  onStartShorts: (minutes: number) => void;
  onEndShorts: () => void;
};

/**
 * The Focus home: your apps like on the home screen (tap to open, hold or
 * "Bearbeiten" to change what Focus does in them), then what applies to
 * all apps.
 */
export function SettingsScreen({
  settings,
  onChange,
  onOpenApp,
  appBadges,
  health,
  diagnostics,
  clearingWebsiteData,
  onRestartApp,
  onOpenInstagramApp,
  onLogoutApp,
  onResetSettings,
  onResetDiagnostics,
  usageLog,
  onResetUsage,
  reels,
  onStartReels,
  onEndReels,
  shorts,
  onStartShorts,
  onEndShorts,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<'home' | 'about' | 'status'>('home');
  const [editMode, setEditMode] = useState(false);
  const [editingApp, setEditingApp] = useState<ServiceId | null>(null);

  const closeSheetThen = (action: () => void) => () => {
    setEditingApp(null);
    setEditMode(false);
    action();
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.groupedBackground }]}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: tabBarSpace(insets.bottom) + 12,
        }}
      >
        <Text style={[styles.largeTitle, { color: theme.label }]}>Loopweg</Text>
        <Text style={[styles.intro, { color: theme.secondaryLabel }]}>
          Social ohne Sog.
        </Text>

        <View style={styles.appsHeader}>
          <Text style={[styles.sectionTitle, { color: theme.secondaryLabel }]}>
            WOHIN MÖCHTEST DU?
          </Text>
          <Pressable
            onPress={() => setEditMode(value => !value)}
            hitSlop={10}
            accessibilityRole="button"
            style={styles.editButton}
          >
            {editMode ? null : <PencilIcon color={theme.accent} size={15} />}
            <Text style={[styles.editLabel, { color: theme.accent }]}>
              {editMode ? 'Fertig' : 'Bearbeiten'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.grid}>
          {SERVICE_IDS.map((id, index) => (
            <AppTile
              key={id}
              id={id}
              staggered={index % 2 === 1}
              editing={editMode}
              badge={
                id === 'instagram' && reels.state === 'active'
                  ? `Reels ${formatCountdown(reels.remainingMs)}`
                  : id === 'youtube' && shorts.state === 'active'
                  ? `Shorts ${formatCountdown(shorts.remainingMs)}`
                  : appBadges[id]
              }
              onPress={() => (editMode ? setEditingApp(id) : onOpenApp(id))}
              onLongPress={() => setEditingApp(id)}
            />
          ))}
        </View>

        {settings.trackUsage ? (
          <UsageCard log={usageLog} now={Date.now()} />
        ) : null}

        <GroupedSection title="Alle Apps">
          <ValueRow
            label="Pause vor dem Öffnen"
            detail="Ein paar Sekunden Durchatmen, bevor eine App aufgeht – auch wenn du nach 5 Minuten zurückkommst."
            value={pauseLabel(settings.pauseSeconds)}
            onPress={() => pickPause(settings.pauseSeconds, onChange)}
          />
          <SwitchRow
            label="Graustufen"
            detail="Ohne Farbe sind Feeds spürbar weniger fesselnd."
            value={settings.grayscale}
            onValueChange={value => onChange({ grayscale: value })}
          />
          <SwitchRow
            label="Nutzungszeit zählen"
            detail="Bleibt auf diesem iPhone."
            value={settings.trackUsage}
            onValueChange={value => onChange({ trackUsage: value })}
          />
          <SwitchRow
            label="Zuletzt genutzte App direkt öffnen"
            detail="Sonst startet Loopweg hier bei deinen Apps."
            value={settings.openLastAppOnLaunch}
            onValueChange={value => onChange({ openLastAppOnLaunch: value })}
          />
          <SwitchRow
            label="Letzten Ort merken"
            detail="Nach einem Neustart geht es dort weiter, wo du warst – nie bei Reels oder Explore."
            value={settings.keepLastLocation}
            onValueChange={value => onChange({ keepLastLocation: value })}
          />
        </GroupedSection>

        <GroupedSection>
          <ButtonRow
            label="Filterstatus"
            onPress={() => setPage('status')}
            chevron
          />
          <ButtonRow
            label="Datenschutz & Grenzen"
            onPress={() => setPage('about')}
            chevron
          />
        </GroupedSection>

        <GroupedSection>
          <ButtonRow
            label="Nutzungszeit zurücksetzen"
            onPress={onResetUsage}
            destructive
          />
          <ButtonRow
            label="Loopweg-Einstellungen zurücksetzen"
            onPress={onResetSettings}
            destructive
          />
        </GroupedSection>

        <Text style={[styles.about, { color: theme.tertiaryLabel }]}>
          Loopweg 0.17 · Kein Konto, keine Cloud, kein Tracking.{'\n'}
          Deine Einstellungen bleiben auf diesem iPhone.
        </Text>
      </ScrollView>

      {page === 'about' ? <AboutScreen onBack={() => setPage('home')} /> : null}
      {page === 'status' ? (
        <StatusScreen
          health={health}
          diagnostics={diagnostics}
          onResetDiagnostics={onResetDiagnostics}
          onBack={() => setPage('home')}
        />
      ) : null}

      <AppSettingsSheet
        app={editingApp}
        onClose={() => setEditingApp(null)}
        settings={settings}
        onChange={onChange}
        reels={reels}
        onStartReels={minutes => closeSheetThen(() => onStartReels(minutes))()}
        onEndReels={onEndReels}
        shorts={shorts}
        onStartShorts={minutes =>
          closeSheetThen(() => onStartShorts(minutes))()
        }
        onEndShorts={onEndShorts}
        onRestartApp={app => closeSheetThen(() => onRestartApp(app))()}
        onOpenInstagramApp={onOpenInstagramApp}
        onLogoutApp={onLogoutApp}
        clearingWebsiteData={clearingWebsiteData}
      />
    </View>
  );
}

function pauseLabel(seconds: PauseSeconds): string {
  return seconds === 0 ? 'Aus' : `${seconds} s`;
}

function pickPause(
  current: PauseSeconds,
  onChange: (patch: Partial<FocusSettings>) => void,
) {
  const options = PAUSE_OPTIONS_S.map(seconds =>
    seconds === 0 ? 'Aus' : `${seconds} Sekunden`,
  );
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: 'Pause vor dem Öffnen',
      options: [...options, 'Abbrechen'],
      cancelButtonIndex: options.length,
      destructiveButtonIndex: PAUSE_OPTIONS_S.indexOf(0),
    },
    index => {
      const seconds = PAUSE_OPTIONS_S[index];
      if (seconds !== undefined && seconds !== current) {
        onChange({ pauseSeconds: seconds });
      }
    },
  );
}

const CARD_COLORS: Record<ServiceId, { light: string; dark: string }> = {
  instagram: { light: '#FCECE7', dark: '#382522' },
  youtube: { light: '#FBE8E8', dark: '#392326' },
  x: { light: '#E8EDF0', dark: '#262C32' },
  reddit: { light: '#FBEDE3', dark: '#3A2B22' },
};

/** A roomy destination card that also works as the app's edit affordance. */
function AppTile({
  id,
  editing,
  badge,
  staggered,
  onPress,
  onLongPress,
}: {
  id: ServiceId;
  editing: boolean;
  badge?: string;
  staggered: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const name = SERVICE_INFO[id].name;
  const surface = CARD_COLORS[id][theme.dark ? 'dark' : 'light'];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={editing ? `${name} bearbeiten` : `${name} öffnen`}
      accessibilityHint={`${SERVICE_INFO[id].tagline}. Gedrückt halten zum Bearbeiten.`}
      accessibilityActions={[{ name: 'longpress', label: 'Bearbeiten' }]}
      onAccessibilityAction={onLongPress}
      style={({ pressed }) => [
        styles.tile,
        staggered ? styles.staggered : null,
        { backgroundColor: surface },
        pressed ? styles.pressed : null,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.decoration,
          theme.dark ? styles.decorationDark : styles.decorationLight,
        ]}
      />
      <View style={styles.iconRow}>
        <AppIcon id={id} size={56} />
        {editing ? (
          <View
            style={[
              styles.editBadge,
              { backgroundColor: theme.cell, borderColor: theme.separator },
            ]}
          >
            <PencilIcon color={theme.label} size={13} />
          </View>
        ) : (
          <Text style={[styles.arrow, { color: theme.label }]}>↗</Text>
        )}
      </View>
      <View style={styles.cardCopy}>
        <Text
          style={[styles.tileLabel, { color: theme.label }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={[styles.tagline, { color: theme.secondaryLabel }]}
          numberOfLines={2}
        >
          {SERVICE_INFO[id].tagline}
        </Text>
        {badge ? (
          <Text
            style={[styles.tileBadge, { color: theme.accent }]}
            numberOfLines={1}
          >
            {badge}
          </Text>
        ) : null}
      </View>
    </Pressable>
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
  intro: {
    fontSize: 16,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 24,
  },
  appsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 22,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  editLabel: {
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    rowGap: 12,
    marginBottom: 32,
  },
  tile: {
    width: '47%',
    minHeight: 178,
    padding: 15,
    borderRadius: 25,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  staggered: {
    marginTop: 18,
  },
  decoration: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 20,
    top: -57,
    right: -53,
  },
  decorationLight: {
    borderColor: '#FFFFFF99',
  },
  decorationDark: {
    borderColor: '#FFFFFF18',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  arrow: {
    fontSize: 22,
    lineHeight: 25,
    opacity: 0.65,
  },
  cardCopy: {
    gap: 3,
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
  editBadge: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  tagline: {
    fontSize: 12,
    lineHeight: 16,
  },
  tileBadge: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  about: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginHorizontal: 32,
  },
});
