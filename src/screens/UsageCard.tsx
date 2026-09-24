import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UsageLog, formatDuration, summarize } from '../usage/usage';
import { useTheme } from '../ui/theme';

const CHART_HEIGHT = 64;
/** Bars scale to at least this, so 3 minutes never look like a full day. */
const MIN_SCALE_SECONDS = 30 * 60;

/**
 * Today's time in Focus as the headline, the last 7 days as a small bar
 * chart underneath. Tapping a day shows its value. Local data only.
 */
export function UsageCard({ log, now }: { log: UsageLog; now: number }) {
  const theme = useTheme();
  const summary = useMemo(() => summarize(log, now), [log, now]);
  const [selected, setSelected] = useState(6);
  const day = summary.days[selected] ?? summary.days[6];
  const scale = Math.max(
    MIN_SCALE_SECONDS,
    ...summary.days.map(d => d.seconds),
  );

  return (
    <View style={[styles.card, { backgroundColor: theme.cell }]}>
      <Text style={[styles.caption, { color: theme.secondaryLabel }]}>
        {day.isToday ? 'Heute in Focus' : `${day.label} in Focus`}
      </Text>
      <Text style={[styles.hero, { color: theme.label }]}>
        {formatDuration(day.seconds)}
      </Text>
      <Text style={[styles.caption, { color: theme.secondaryLabel }]}>
        Ø {formatDuration(summary.weekAverageSeconds)} pro Tag · 7 Tage
      </Text>

      <View
        style={styles.chart}
        accessibilityLabel={`Nutzung der letzten 7 Tage: ${summary.days
          .map(d => `${d.label} ${formatDuration(d.seconds)}`)
          .join(', ')}`}
      >
        {summary.days.map((d, index) => {
          const height =
            d.seconds > 0
              ? Math.max(4, Math.round((d.seconds / scale) * CHART_HEIGHT))
              : 0;
          const active = index === selected;
          return (
            <Pressable
              key={d.key}
              style={styles.column}
              onPress={() => setSelected(index)}
              accessibilityRole="button"
              accessibilityLabel={`${d.label}: ${formatDuration(d.seconds)}`}
            >
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    { height, backgroundColor: theme.chartBar },
                    active ? null : styles.barMuted,
                  ]}
                />
              </View>
              <View
                style={[styles.baseline, { backgroundColor: theme.separator }]}
              />
              <Text
                style={[
                  styles.dayLabel,
                  { color: active ? theme.label : theme.secondaryLabel },
                  active ? styles.dayLabelActive : null,
                ]}
              >
                {d.isToday ? 'Heute' : d.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 28,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  caption: {
    fontSize: 13,
  },
  hero: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginVertical: 2,
    fontVariant: ['tabular-nums'],
  },
  chart: {
    flexDirection: 'row',
    marginTop: 16,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  barArea: {
    height: CHART_HEIGHT,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 18,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  baseline: {
    alignSelf: 'stretch',
    height: StyleSheet.hairlineWidth,
  },
  dayLabel: {
    fontSize: 11,
    marginTop: 5,
  },
  dayLabelActive: {
    fontWeight: '600',
  },
  barMuted: {
    opacity: 0.55,
  },
});
