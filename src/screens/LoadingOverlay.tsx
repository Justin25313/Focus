import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import {
  InstagramSkeleton,
  SkeletonVariant,
} from '../ui/skeleton/InstagramSkeleton';
import { useTheme } from '../ui/theme';

const FADE_OUT_MS = 180;

/**
 * Covers the WebView while Instagram loads. Appears instantly (no flash of
 * half-rendered page) and fades out once the page reports it has settled.
 */
export function LoadingOverlay({
  variant,
}: {
  /** null hides the overlay. */
  variant: SkeletonVariant | null;
}) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(variant ? 1 : 0)).current;
  const [shown, setShown] = useState<SkeletonVariant | null>(variant);

  useEffect(() => {
    if (variant) {
      opacity.stopAnimation();
      opacity.setValue(1);
      setShown(variant);
      return;
    }
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished) {
        setShown(null);
      }
    });
    return () => fade.stop();
  }, [opacity, variant]);

  if (!shown) {
    return null;
  }
  return (
    <Animated.View
      pointerEvents={variant ? 'auto' : 'none'}
      style={[
        styles.overlay,
        { backgroundColor: theme.webBackground, opacity },
      ]}
    >
      <InstagramSkeleton variant={shown} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
  },
});
