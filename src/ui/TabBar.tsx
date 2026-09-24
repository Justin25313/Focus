import { BlurView } from '@react-native-community/blur';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FocusIcon,
  HomeIcon,
  MessageIcon,
  ProfileIcon,
  SearchIcon,
} from './icons';
import { TAB_BAR_PILL_HEIGHT, tabBarBottom, useTheme } from './theme';

export type TabId = 'feed' | 'search' | 'messages' | 'profile' | 'focus';

/**
 * Same order as Instagram's app, with Focus where Reels would be.
 */
const TABS: { id: TabId; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'feed', label: 'Instagram', Icon: HomeIcon },
  { id: 'focus', label: 'Focus', Icon: FocusIcon },
  { id: 'messages', label: 'Nachrichten', Icon: MessageIcon },
  { id: 'search', label: 'Suche', Icon: SearchIcon },
  { id: 'profile', label: 'Profil', Icon: ProfileIcon },
];

/**
 * Floating glass pill, icons only, like Instagram's current app. Content
 * scrolls underneath it.
 */
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
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: tabBarBottom(insets.bottom) }]}
    >
      <View
        accessibilityRole="tablist"
        style={[styles.pill, { borderColor: theme.barBorder }]}
      >
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="chromeMaterial"
          blurAmount={24}
          reducedTransparencyFallbackColor={theme.cell}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.barBackground },
          ]}
        />
        {TABS.filter(tab => !hiddenTabs.includes(tab.id)).map(
          ({ id, label, Icon }) => {
            const selected = id === active;
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
                <View
                  style={[
                    styles.itemInner,
                    selected ? { backgroundColor: theme.barSelected } : null,
                  ]}
                >
                  <Icon color={theme.label} size={27} filled={selected} />
                </View>
              </Pressable>
            );
          },
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 22,
    right: 22,
    borderRadius: TAB_BAR_PILL_HEIGHT / 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  pill: {
    height: TAB_BAR_PILL_HEIGHT,
    borderRadius: TAB_BAR_PILL_HEIGHT / 2,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  itemInner: {
    height: TAB_BAR_PILL_HEIGHT - 10,
    borderRadius: (TAB_BAR_PILL_HEIGHT - 10) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
