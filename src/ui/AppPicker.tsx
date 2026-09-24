import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SERVICE_INFO, ServiceId } from '../services/services';
import { CheckIcon } from './icons';
import { useTheme } from './theme';

/**
 * One app in Focus's app list. Monograms instead of the apps' logos:
 * Focus refers to the apps descriptively, never with their branding.
 */
export function AppRow({
  id,
  active,
  onPress,
}: {
  id: ServiceId;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const info = SERVICE_INFO[id];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${info.name} öffnen`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: theme.fill } : null,
      ]}
    >
      <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
        <Text style={[styles.monogram, { color: theme.accent }]}>
          {info.monogram}
        </Text>
      </View>
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={[styles.name, { color: theme.label }]}>{info.name}</Text>
          {info.beta ? (
            <Text
              style={[
                styles.beta,
                { color: theme.secondaryLabel, borderColor: theme.separator },
              ]}
            >
              BETA
            </Text>
          ) : null}
        </View>
        <Text style={[styles.tagline, { color: theme.secondaryLabel }]}>
          {info.tagline}
        </Text>
      </View>
      {active ? <CheckIcon color={theme.accent} /> : null}
    </Pressable>
  );
}

/** iOS-style segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.segmented, { backgroundColor: theme.fill }]}
    >
      {options.map(option => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[
              styles.segment,
              selected
                ? [styles.segmentSelected, { backgroundColor: theme.cell }]
                : null,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: theme.label },
                selected ? styles.segmentLabelSelected : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 60,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogram: {
    fontSize: 16,
    fontWeight: '700',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
  },
  beta: {
    fontSize: 10,
    fontWeight: '700',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  tagline: {
    fontSize: 13,
  },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 9,
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 7,
  },
  segmentSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  segmentLabel: {
    fontSize: 13,
  },
  segmentLabelSelected: {
    fontWeight: '600',
  },
});
