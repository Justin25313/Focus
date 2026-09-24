import React, { ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  DimensionValue,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../theme';

/**
 * Skeleton primitives. Every loading state in Focus is built from these,
 * so all placeholders share one colour, one rhythm and one pulse.
 *
 *   <Pulse>
 *     <Bone width={120} height={14} />
 *     <Circle size={40} />
 *     <Lines widths={['90%', '60%']} />
 *   </Pulse>
 */

const PULSE_MS = 750;

/** Animates its children's opacity in one shared, native-driven loop. */
export function Pulse({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: PULSE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: PULSE_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[style, { opacity }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Lädt"
    >
      {children}
    </Animated.View>
  );
}

export function Bone({
  width,
  height,
  radius = 6,
  style,
}: {
  width: DimensionValue;
  height: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.skeleton,
        },
        style,
      ]}
    />
  );
}

export function Circle({
  size,
  style,
}: {
  size: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <Bone width={size} height={size} radius={size / 2} style={style} />;
}

/** A paragraph of text lines. */
export function Lines({
  widths,
  lineHeight = 12,
  gap = 8,
  style,
}: {
  widths: DimensionValue[];
  lineHeight?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap }, style]}>
      {widths.map((width, index) => (
        <Bone key={index} width={width} height={lineHeight} radius={4} />
      ))}
    </View>
  );
}

/** Avatar with one or two text lines next to it — lists, headers, rows. */
export function AvatarRow({
  size = 44,
  widths = ['45%', '70%'],
  style,
}: {
  size?: number;
  widths?: DimensionValue[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.avatarRow, style]}>
      <Circle size={size} />
      <Lines widths={widths} style={styles.flex} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
});
