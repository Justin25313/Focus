import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronIcon } from '../ui/icons';
import { tabBarSpace, useTheme } from '../ui/theme';

export type LinkItem = { key: string; title: string; path: string };

/**
 * A plain list of places in a web app, e.g. YouTube's "Du" (history,
 * watch later, playlists) – native, so it never depends on how the
 * website renders that page.
 */
export function LinkListScreen({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: LinkItem[];
  onOpen: (path: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.background, paddingTop: insets.top },
      ]}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarSpace(insets.bottom) }}
      >
        <Text style={[styles.largeTitle, { color: theme.label }]}>
          {title}
        </Text>
        {items.map((item, index) => (
          <Pressable
            key={item.key}
            onPress={() => onOpen(item.path)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              index > 0
                ? {
                    borderTopColor: theme.separator,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  }
                : null,
              pressed ? { backgroundColor: theme.fill } : null,
            ]}
          >
            <Text style={[styles.rowTitle, { color: theme.label }]}>
              {item.title}
            </Text>
            <ChevronIcon color={theme.tertiaryLabel} />
          </Pressable>
        ))}
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
    marginTop: 10,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 20,
    paddingRight: 20,
    paddingVertical: 15,
  },
  rowTitle: {
    flex: 1,
    fontSize: 17,
  },
});
