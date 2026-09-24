import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from './theme';

export function PrimaryButton({
  title,
  onPress,
  secondary,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? theme.fill : theme.accent,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.title,
          { color: secondary ? theme.label : theme.onAccent },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    alignSelf: 'stretch',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
});
