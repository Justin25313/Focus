import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INSTAGRAM_RULE_VERSION } from '../filtering/instagram/routes';
import { TAB_BAR_HEIGHT, useTheme } from '../ui/theme';

const SECTIONS: { title: string; points: string[] }[] = [
  {
    title: 'Was auf deinem iPhone bleibt',
    points: [
      'Dein Instagram-Login, Cookies und Verlauf – Focus speichert kein Passwort.',
      'Einstellungen, Suchverlauf, Nutzungszeit und Diagnose.',
      'Es gibt keinen Focus-Server, kein Konto und kein Tracking.',
    ],
  },
  {
    title: 'Was Focus nie tut',
    points: [
      'Nachrichten, Beiträge, Seiteninhalte oder Screenshots hochladen.',
      'Analyse- oder Werbe-Code in Instagram einschleusen.',
      'Dir Code von Instagram-Seiten in der App ausführen lassen.',
    ],
  },
  {
    title: 'Grenzen',
    points: [
      'Focus nutzt Instagram im Web. Kamera, Filter, manche Posting-Funktionen, Anrufe und Push-Mitteilungen gibt es nur in der Instagram-App.',
      'Geteilte Reels bleiben vorerst gesperrt – lieber gesperrt als ein Schlupfloch in den Reels-Feed.',
      'Werbung und Vorschläge werden nur bei eindeutiger Kennzeichnung ausgeblendet; einzelne können durchrutschen.',
      'Instagram ändert sein Web regelmäßig. Taucht etwas Neues auf, zeigt der Filterstatus „Unbekannte Route“.',
      'Die Instagram-App selbst wird nicht gesperrt. Leg sie am besten in die App-Mediathek.',
    ],
  },
];

export function AboutScreen({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.container, { backgroundColor: theme.groupedBackground }]}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Zurück zu Focus"
        >
          <Text style={[styles.back, { color: theme.accent }]}>‹ Focus</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
        }}
      >
        <Text style={[styles.title, { color: theme.label }]}>
          Datenschutz & Grenzen
        </Text>
        {SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.label }]}>
              {section.title}
            </Text>
            <View style={[styles.card, { backgroundColor: theme.cell }]}>
              {section.points.map(point => (
                <View key={point} style={styles.point}>
                  <View
                    style={[styles.dot, { backgroundColor: theme.accent }]}
                  />
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  back: {
    fontSize: 17,
    paddingVertical: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginHorizontal: 20,
    marginBottom: 18,
  },
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
