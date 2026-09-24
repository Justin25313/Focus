import {
  LiquidGlassContainerView,
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { BlurView } from '@react-native-community/blur';
import React, { ReactNode } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FocusIcon,
  HomeIcon,
  MessageIcon,
  ProfileIcon,
  ReelsIcon,
  SearchIcon,
} from './icons';
import { TAB_BAR_PILL_HEIGHT, tabBarBottom, useTheme } from './theme';

export type TabId =
  | 'feed'
  | 'reels'
  | 'search'
  | 'messages'
  | 'profile'
  | 'focus';

/** Buttons of the current app (Instagram); other services can bring their own. */
const APP_TABS: { id: TabId; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'feed', label: 'Instagram', Icon: HomeIcon },
  // Only while a timed Reels window is running.
  { id: 'reels', label: 'Reels', Icon: ReelsIcon },
  { id: 'messages', label: 'Nachrichten', Icon: MessageIcon },
  { id: 'search', label: 'Suche', Icon: SearchIcon },
  { id: 'profile', label: 'Profil', Icon: ProfileIcon },
];

const GAP = 10;

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
  active,
  onPress,
  hiddenTabs = [],
  reelsCountdown,
}: {
  active: TabId;
  onPress: (tab: TabId) => void;
  /** Tabs that do not apply right now (e.g. no profile before login). */
  hiddenTabs?: TabId[];
  /** Remaining Reels time, shown under the Reels icon. */
  reelsCountdown?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const focusSelected = active === 'focus';

  return (
    <LiquidGlassContainerView
      spacing={GAP}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: tabBarBottom(insets.bottom) }]}
    >
      <Glass style={styles.pill}>
        <View accessibilityRole="tablist" style={styles.row}>
          {APP_TABS.filter(tab => !hiddenTabs.includes(tab.id)).map(
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
                    {id === 'reels' && reelsCountdown ? (
                      <>
                        <Icon color={theme.label} size={22} filled={selected} />
                        <Text
                          style={[styles.countdown, { color: theme.label }]}
                          accessibilityLabel={`Noch ${reelsCountdown}`}
                        >
                          {reelsCountdown}
                        </Text>
                      </>
                    ) : (
                      <Icon color={theme.label} size={27} filled={selected} />
                    )}
                  </View>
                </Pressable>
              );
            },
          )}
        </View>
      </Glass>

      <Glass style={styles.circle}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Focus"
          accessibilityHint="Zurück zu Focus"
          accessibilityState={{ selected: focusSelected }}
          onPress={() => onPress('focus')}
          style={[
            styles.circleInner,
            focusSelected ? { backgroundColor: theme.barSelected } : null,
          ]}
          hitSlop={6}
        >
          <FocusIcon color={theme.label} size={27} filled={focusSelected} />
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
  countdown: {
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
