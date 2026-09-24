import React from 'react';
import {
  BlockReason,
  INSTAGRAM_RULE_VERSION,
} from '../filtering/instagram/routes';
import { Diagnostics } from '../storage/diagnostics';
import { formatTimestamp } from '../ui/format';
import { ButtonRow, GroupedSection, ValueRow } from '../ui/Grouped';
import { SubPage } from '../ui/SubPage';
import { useTheme } from '../ui/theme';

export type FilterHealth = 'starting' | 'active' | 'noResponse';

const REASON_LABEL: Record<BlockReason, string> = {
  reels: 'Reels',
  sharedReel: 'Einzelnes Reel',
  explore: 'Explore',
  feed: 'Feed',
  stories: 'Stories',
  saved: 'Gespeichert',
  shorts: 'Shorts',
  ytHome: 'YouTube-Start',
  ytSubs: 'YouTube-Abos',
  ytExplore: 'YouTube-Trends',
};

/** Whether the Instagram filter is running, and what it did (local only). */
export function StatusScreen({
  health,
  diagnostics,
  onResetDiagnostics,
  onBack,
}: {
  health: FilterHealth;
  diagnostics: Diagnostics;
  onResetDiagnostics: () => void;
  onBack: () => void;
}) {
  const theme = useTheme();
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
    <SubPage title="Filterstatus" onBack={onBack}>
      <GroupedSection footer="Diagnosedaten bleiben ausschließlich auf diesem iPhone.">
        <ValueRow label="Status" value={healthLabel} valueColor={healthColor} />
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
      </GroupedSection>
      <GroupedSection>
        <ButtonRow label="Diagnose zurücksetzen" onPress={onResetDiagnostics} />
      </GroupedSection>
    </SubPage>
  );
}
