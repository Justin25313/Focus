import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OfflineIcon } from '../ui/icons';
import { PrimaryButton } from '../ui/PrimaryButton';
import { useTheme } from '../ui/theme';

export function OfflineOverlay({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <OfflineIcon color={theme.secondaryLabel} size={48} />
      <Text style={[styles.title, { color: theme.label }]}>
        Instagram ist nicht erreichbar
      </Text>
      <Text style={[styles.body, { color: theme.secondaryLabel }]}>
        Prüfe deine Internetverbindung und versuche es erneut.
      </Text>
      <View style={styles.button}>
        <PrimaryButton title="Erneut versuchen" onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 16,
  },
});
