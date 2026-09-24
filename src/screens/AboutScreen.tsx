import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { INSTAGRAM_RULE_VERSION } from '../filtering/instagram/routes';
import { SubPage } from '../ui/SubPage';
import { useTheme } from '../ui/theme';

const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: 'Was auf deinem iPhone bleibt',
    points: [
      'Deine Logins bei Instagram und YouTube, Cookies und Verlauf – Focus speichert kein Passwort.',
      'Einstellungen, Suchverlauf, Nutzungszeit und Diagnose.',
      'Es gibt keinen Focus-Server, kein Konto und kein Tracking.',
      'Beim Tippen in der YouTube-Suche fragt Focus Google nach Vorschlägen – ohne dein Login, nur mit dem getippten Text.',
    ],
  },
  {
    title: 'Was Focus nie tut',
    points: [
      'Nachrichten, Beiträge, Seiteninhalte oder Screenshots hochladen.',
      'Analyse- oder Werbe-Code in Instagram oder YouTube einschleusen.',
      'Code von Webseiten in der App ausführen lassen.',
    ],
  },
  {
    title: 'Grenzen',
    points: [
      'Focus nutzt Instagram im Web. Kamera, Filter, manche Posting-Funktionen, Anrufe und Push-Mitteilungen gibt es nur in der Instagram-App.',
      'Geteilte Reels bleiben vorerst gesperrt – lieber gesperrt als ein Schlupfloch in den Reels-Feed.',
      'Werbung und Vorschläge werden nur bei eindeutiger Kennzeichnung ausgeblendet; einzelne können durchrutschen.',
      'Instagram ändert sein Web regelmäßig. Taucht etwas Neues auf, zeigt der Filterstatus „Unbekannte Route“.',
      'Die Instagram- und YouTube-Apps selbst werden nicht gesperrt. Leg sie am besten in die App-Mediathek.',
    ],
  },
];

export function AboutScreen({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  return (
    <SubPage title="Datenschutz & Grenzen" onBack={onBack}>
      {SECTIONS.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.label }]}>
            {section.title}
          </Text>
          <View style={[styles.card, { backgroundColor: theme.cell }]}>
            {section.points.map(point => (
              <View key={point} style={styles.point}>
                <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                <Text style={[styles.pointText, { color: theme.label }]}>
                  {point}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
      <Text style={[styles.footer, { color: theme.tertiaryLabel }]}>
        Instagram-Regeln v{INSTAGRAM_RULE_VERSION}
      </Text>
    </SubPage>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginHorizontal: 20,
    marginBottom: 8,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 6,
  },
  point: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  pointText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
  footer: {
    fontSize: 13,
    textAlign: 'center',
  },
});
