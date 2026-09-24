import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FocusIcon,
  HomeIcon,
  MessageIcon,
  ProfileIcon,
  SearchIcon,
} from './icons';
import { TAB_BAR_HEIGHT, useTheme } from './theme';

export type TabId = 'feed' | 'search' | 'messages' | 'profile' | 'focus';

const TABS: { id: TabId; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'feed', label: 'Instagram', Icon: HomeIcon },
  { id: 'search', label: 'Suche', Icon: SearchIcon },
  { id: 'messages', label: 'Nachrichten', Icon: MessageIcon },
  { id: 'profile', label: 'Profil', Icon: ProfileIcon },
  { id: 'focus', label: 'Focus', Icon: FocusIcon },
];

export function TabBar({
  active,
  onPress,
  hiddenTabs = [],
}: {
  active: TabId;
  onPress: (tab: TabId) => void;
  /** Tabs that do not apply right now (e.g. no profile before login). */
  hiddenTabs?: TabId[];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: theme.barBackground,
          borderTopColor: theme.separator,
        },
      ]}
    >
      {TABS.filter(tab => !hiddenTabs.includes(tab.id)).map(
        ({ id, label, Icon }) => {
          const selected = id === active;
          const color = selected ? theme.label : theme.secondaryLabel;
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              onPress={() => onPress(id)}
              style={styles.item}
              hitSlop={4}
            >
              <Icon color={color} size={25} filled={selected} />
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        },
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 5,
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
