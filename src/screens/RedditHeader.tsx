import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '../ui/AppIcon';
import { BackIcon, MenuIcon, PlusIcon } from '../ui/icons';
import { useTheme } from '../ui/theme';

export const REDDIT_HEADER_HEIGHT = 58;

/**
 * Reddit's app header, in place of the website's: a round button on the
 * left (your communities, or back inside a post), the search pill, and
 * a round "+" to create a post.
 */
export function RedditHeader({
  canGoBack,
  onMenu,
  onBack,
  onSearch,
  onCreate,
}: {
  canGoBack: boolean;
  onMenu: () => void;
  onBack: () => void;
  onSearch: () => void;
  onCreate: () => void;
}) {
  const theme = useTheme();
  const round = [
    styles.round,
    { backgroundColor: theme.cell, borderColor: theme.separator },
  ];
  return (
    <View style={[styles.bar, { backgroundColor: theme.background }]}>
      <Pressable
        onPress={canGoBack ? onBack : onMenu}
        accessibilityRole="button"
        accessibilityLabel={canGoBack ? 'Zurück' : 'Deine Communities'}
        hitSlop={6}
        style={({ pressed }) => [round, pressed ? styles.pressed : null]}
      >
        {canGoBack ? (
          <BackIcon color={theme.label} />
        ) : (
          <MenuIcon color={theme.label} />
        )}
      </Pressable>
      <Pressable
        onPress={onSearch}
        accessibilityRole="search"
        accessibilityLabel="Reddit durchsuchen"
        style={({ pressed }) => [
          styles.pill,
          { backgroundColor: theme.cell, borderColor: theme.separator },
          pressed ? styles.pressed : null,
        ]}
      >
        <AppIcon id="reddit" size={28} />
        <Text
          style={[styles.pillText, { color: theme.secondaryLabel }]}
          numberOfLines={1}
        >
          Reddit durchsuchen
        </Text>
      </Pressable>
      <Pressable
        onPress={onCreate}
        accessibilityRole="button"
        accessibilityLabel="Beitrag erstellen"
        hitSlop={6}
        style={({ pressed }) => [round, pressed ? styles.pressed : null]}
      >
        <PlusIcon color={theme.label} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: REDDIT_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 14,
  },
  pillText: {
    fontSize: 17,
  },
  pressed: {
    opacity: 0.6,
  },
});
