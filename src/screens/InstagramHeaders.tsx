import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDownIcon, HeartIcon, MenuIcon, PlusIcon } from '../ui/icons';
import { useTheme } from '../ui/theme';

export const INSTAGRAM_HEADER_HEIGHT = 54;

function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.icon, pressed ? styles.pressed : null]}
    >
      {children}
    </Pressable>
  );
}

/** Home, like the app: "+", "Für dich ⌄" (or "Gefolgt ⌄"), heart. */
export function FeedHeader({
  title,
  onCreate,
  onTitle,
  onActivity,
}: {
  title: string;
  onCreate: () => void;
  onTitle: () => void;
  onActivity: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: theme.background }]}>
      <IconButton label="Erstellen" onPress={onCreate}>
        <PlusIcon color={theme.label} size={30} />
      </IconButton>
      <Pressable
        onPress={onTitle}
        accessibilityRole="button"
        accessibilityLabel={`${title}, Feed wählen`}
        style={({ pressed }) => [styles.title, pressed ? styles.pressed : null]}
      >
        <Text style={[styles.titleText, { color: theme.label }]}>{title}</Text>
        <ChevronDownIcon color={theme.label} size={15} />
      </Pressable>
      <IconButton label="Aktivität" onPress={onActivity}>
        <HeartIcon color={theme.label} size={29} />
      </IconButton>
    </View>
  );
}

/** Your profile, like the app: "+", username ⌄, menu. */
export function ProfileHeader({
  username,
  onCreate,
  onMenu,
}: {
  username: string;
  onCreate: () => void;
  onMenu: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: theme.background }]}>
      <IconButton label="Erstellen" onPress={onCreate}>
        <PlusIcon color={theme.label} size={30} />
      </IconButton>
      <View style={styles.title}>
        <Text
          style={[styles.titleText, { color: theme.label }]}
          numberOfLines={1}
        >
          {username}
        </Text>
        <ChevronDownIcon color={theme.label} size={15} />
      </View>
      <IconButton label="Menü" onPress={onMenu}>
        <MenuIcon color={theme.label} size={28} />
      </IconButton>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: INSTAGRAM_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  titleText: {
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  pressed: {
    opacity: 0.5,
  },
});
