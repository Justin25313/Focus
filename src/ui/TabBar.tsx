import {
  LiquidGlassContainerView,
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { BlurView } from '@react-native-community/blur';
import React, { ReactNode } from 'react';
import {
  ColorValue,
  Image,
  PlatformColor,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_PILL_HEIGHT, tabBarBottom, useTheme } from './theme';
import { TAB_ICONS, TabIconName } from './tabIcons';
import type { WebAppId } from '../services/services';

export type TabId = string;

export type TabItem = { id: TabId; label: string; icon: TabIconName };

/** Instagram's buttons, in the app's order. */
export const INSTAGRAM_TABS: TabItem[] = [
  { id: 'feed', label: 'Instagram', icon: 'home' },
  // Only while a timed Reels window is running.
  { id: 'reels', label: 'Reels', icon: 'reels' },
  { id: 'messages', label: 'Nachrichten', icon: 'message' },
  { id: 'search', label: 'Suche', icon: 'search' },
  { id: 'profile', label: 'Profil', icon: 'profile' },
];

/** YouTube: start (subscriptions), search, your library. No Shorts. */
export const YOUTUBE_TABS: TabItem[] = [
  { id: 'ytHome', label: 'YouTube', icon: 'home' },
  { id: 'ytSearch', label: 'Suche', icon: 'search' },
  { id: 'ytYou', label: 'Du', icon: 'profile' },
];

/** X: timeline (Following), search, notifications, messages. */
export const X_TABS: TabItem[] = [
  { id: 'xHome', label: 'Startseite', icon: 'home' },
  { id: 'xSearch', label: 'Suche', icon: 'search' },
  { id: 'xNotifications', label: 'Mitteilungen', icon: 'bell' },
  { id: 'xMessages', label: 'Nachrichten', icon: 'message' },
];

/** Reddit: Focus's start (your communities, search), notifications. */
export const REDDIT_TABS: TabItem[] = [
  { id: 'rHome', label: 'Communities', icon: 'home' },
  { id: 'rNotifications', label: 'Mitteilungen', icon: 'bell' },
];

export const WEB_APP_TABS: Record<WebAppId, TabItem[]> = {
  youtube: YOUTUBE_TABS,
  x: X_TABS,
  reddit: REDDIT_TABS,
};

const GAP = 10;

/**
 * Colors that resolve inside the glass: Liquid Glass turns light over
 * bright content and dark over dark content, and these follow it (a fixed
 * theme color would give white icons on white glass).
 */
const glassLabel: ColorValue = PlatformColor('labelColor');
const glassSelected: ColorValue = PlatformColor('tertiarySystemFillColor');

function TabIcon({
  name,
  filled,
  size,
  color,
}: {
  name: TabIconName;
  filled: boolean;
  size: number;
  color: ColorValue;
}) {
  return (
    <Image
      source={TAB_ICONS[name][filled ? 'filled' : 'outline']}
      style={{ width: size, height: size, tintColor: color }}
      accessibilityIgnoresInvertColors
    />
  );
}

/**
 * iOS 26 Liquid Glass where available (real refraction, adapts to what is
 * underneath), a blurred material everywhere else.
 */
function Glass({
  style,
  children,
}: {
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const theme = useTheme();
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView style={style} effect="regular" interactive>
        {children}
      </LiquidGlassView>
    );
  }
  return (
    <View style={[style, styles.fallback, { borderColor: theme.barBorder }]}>
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
      {children}
    </View>
  );
}

/**
 * Floating tab bar like Instagram's current app: the app's buttons in one
 * glass pill, and a separate round Focus button on the right that leads
 * back to Focus (later also to other apps).
 */
export function TabBar({
  tabs,
  active,
  onPress,
  hiddenTabs = [],
  reelsCountdown,
}: {
  /** The current app's buttons; empty for apps that bring their own UI. */
  tabs: TabItem[];
  active: TabId;
  onPress: (tab: TabId) => void;
  /** Tabs that do not apply right now (e.g. no profile before login). */
  hiddenTabs?: TabId[];
  /** Remaining Reels time, shown under the Reels icon. */
  reelsCountdown?: string;
}) {
  const insets = useSafeAreaInsets();
  const focusSelected = active === 'focus';
  const visibleTabs = tabs.filter(tab => !hiddenTabs.includes(tab.id));

  return (
    <LiquidGlassContainerView
      spacing={GAP}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: tabBarBottom(insets.bottom) }]}
    >
      {visibleTabs.length > 0 ? (
        <Glass style={styles.pill}>
          <View accessibilityRole="tablist" style={styles.row}>
            {visibleTabs.map(({ id, label, icon }) => {
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
                      selected ? styles.selected : null,
                    ]}
                  >
                    {id === 'reels' && reelsCountdown ? (
                      <>
                        <TabIcon
                          name={icon}
                          color={glassLabel}
                          size={22}
                          filled={selected}
                        />
                        <Text
                          style={styles.countdown}
                          accessibilityLabel={`Noch ${reelsCountdown}`}
                        >
                          {reelsCountdown}
                        </Text>
                      </>
                    ) : (
                      <TabIcon
                        name={icon}
                        color={glassLabel}
                        size={27}
                        filled={selected}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Glass>
      ) : (
        <View style={styles.spacer} />
      )}

      <Glass style={styles.circle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Focus"
          accessibilityHint="Zurück zu Focus"
          accessibilityState={{ selected: focusSelected }}
          onPress={() => onPress('focus')}
          style={[styles.circleInner, focusSelected ? styles.selected : null]}
          hitSlop={6}
        >
          <TabIcon
            name="focus"
            color={glassLabel}
            size={27}
            filled={focusSelected}
          />
        </Pressable>
      </Glass>
    </LiquidGlassContainerView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
  },
  spacer: {
    flex: 1,
  },
  pill: {
    flex: 1,
    height: TAB_BAR_PILL_HEIGHT,
    borderRadius: TAB_BAR_PILL_HEIGHT / 2,
  },
  circle: {
    width: TAB_BAR_PILL_HEIGHT,
    height: TAB_BAR_PILL_HEIGHT,
    borderRadius: TAB_BAR_PILL_HEIGHT / 2,
  },
  fallback: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
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
  selected: {
    backgroundColor: glassSelected,
  },
  countdown: {
    color: glassLabel,
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  circleInner: {
    flex: 1,
    margin: 5,
    borderRadius: (TAB_BAR_PILL_HEIGHT - 10) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
