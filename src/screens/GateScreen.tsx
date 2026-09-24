import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LimitStatus } from '../controls/limits';
import { SERVICE_INFO, ServiceId } from '../services/services';
import { AppIcon } from '../ui/AppIcon';
import { PrimaryButton } from '../ui/PrimaryButton';
import { useTheme } from '../ui/theme';
import { formatDuration } from '../usage/usage';

const BREATH_MS = 4000;
const RING = 180;

/**
 * Stands between you and an app:
 *  pause – a few seconds of breathing before the app opens, so opening it
 *          is a decision rather than a reflex;
 *  limit – today's time is used up; the app stays closed until tomorrow.
 */
export function GateScreen({
  app,
  mode,
  pauseSeconds,
  usedTodaySeconds,
  limit,
  onOpen,
  onLeave,
}: {
  app: ServiceId;
  mode: 'pause' | 'limit';
  pauseSeconds: number;
  usedTodaySeconds: number;
  limit: LimitStatus;
  onOpen: () => void;
  onLeave: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const name = SERVICE_INFO[app].name;
  const remaining = useCountdown(mode === 'pause' ? pauseSeconds : 0);
  const breath = useBreathing(mode === 'pause');

  const usage =
    limit.state === 'none'
      ? `Heute: ${formatDuration(usedTodaySeconds)}`
      : `Heute: ${formatDuration(usedTodaySeconds)} von ${formatDuration(
          limit.limitSeconds,
        )}`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.groupedBackground,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      accessibilityViewIsModal
    >
      <View style={styles.center}>
        {mode === 'pause' ? (
          <View style={styles.ringArea}>
            <Animated.View
              style={[
                styles.ring,
                { backgroundColor: theme.accentSoft },
                { transform: [{ scale: breath }] },
              ]}
            />
            <AppIcon id={app} size={72} />
          </View>
        ) : (
          <View style={styles.ringArea}>
            <View style={styles.dimmed}>
              <AppIcon id={app} size={72} />
            </View>
          </View>
        )}

        <Text style={[styles.title, { color: theme.label }]}>
          {mode === 'pause' ? 'Kurz durchatmen' : 'Tageslimit erreicht'}
        </Text>
        <Text style={[styles.body, { color: theme.secondaryLabel }]}>
          {mode === 'pause'
            ? `Was willst du in ${name} machen? Wenn du es weißt: los.`
            : `${name} ist für heute zu. Morgen geht es wieder.`}
        </Text>
        <Text style={[styles.usage, { color: theme.secondaryLabel }]}>
          {usage}
        </Text>
      </View>

      <View style={styles.actions}>
        {mode === 'pause' ? (
          <PrimaryButton
            title={remaining > 0 ? `${remaining}` : `${name} öffnen`}
            onPress={onOpen}
            disabled={remaining > 0}
          />
        ) : null}
        <Pressable
          onPress={onLeave}
          hitSlop={8}
          accessibilityRole="button"
          style={styles.secondary}
        >
          <Text style={[styles.secondaryLabel, { color: theme.accent }]}>
            {mode === 'pause' ? 'Doch nicht' : 'Zurück zu Focus'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Whole seconds left, counting down from `seconds`. */
function useCountdown(seconds: number): number {
  const startedAt = useRef(Date.now());
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    startedAt.current = Date.now();
    setLeft(seconds);
    if (seconds <= 0) {
      return;
    }
    const timer = setInterval(() => {
      const next = Math.max(
        0,
        Math.ceil((startedAt.current + seconds * 1000 - Date.now()) / 1000),
      );
      setLeft(next);
      if (next === 0) {
        clearInterval(timer);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [seconds]);
  return left;
}

/** Slow in-and-out scale for the breathing ring (still if reduced motion). */
function useBreathing(active: boolean): Animated.Value {
  const value = useRef(new Animated.Value(0.72)).current;
  useEffect(() => {
    if (!active) {
      return;
    }
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (cancelled || reduced) {
        return;
      }
      const ease = Easing.inOut(Easing.sin);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: BREATH_MS,
            easing: ease,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.72,
            duration: BREATH_MS,
            easing: ease,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [active, value]);
  return value;
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringArea: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
  },
  dimmed: {
    opacity: 0.4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 17,
    lineHeight: 23,
    textAlign: 'center',
  },
  usage: {
    fontSize: 15,
    marginTop: 18,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    gap: 14,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryLabel: {
    fontSize: 17,
  },
});
