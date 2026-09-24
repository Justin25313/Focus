import React, { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tabBarSpace, useTheme } from './theme';

/** A page pushed over the Focus home, with a back link and a large title. */
export function SubPage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
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
          paddingBottom: tabBarSpace(insets.bottom) + 12,
        }}
      >
        <Text style={[styles.title, { color: theme.label }]}>{title}</Text>
        {children}
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
});
