import React, { Children, Fragment, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { CheckIcon, ChevronIcon } from './icons';
import { useTheme } from './theme';

/** Native-feeling inset grouped list, in the style of iOS Settings. */
export function GroupedSection({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={[styles.header, { color: theme.secondaryLabel }]}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={[styles.card, { backgroundColor: theme.cell }]}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View
                style={[styles.separator, { backgroundColor: theme.separator }]}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <Text style={[styles.footer, { color: theme.secondaryLabel }]}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

type RowBaseProps = {
  label: string;
  detail?: string;
};

export function SwitchRow({
  label,
  detail,
  value,
  onValueChange,
}: RowBaseProps & { value: boolean; onValueChange: (value: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityLabel={label}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.label }]}>{label}</Text>
        {detail ? (
          <Text style={[styles.detail, { color: theme.secondaryLabel }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.accent }}
      />
    </View>
  );
}

/** One option of a single-choice list; shows a checkmark when selected. */
export function CheckRow({
  label,
  detail,
  checked,
  onPress,
}: RowBaseProps & { checked: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: theme.fill } : null,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.label }]}>{label}</Text>
        {detail ? (
          <Text style={[styles.detail, { color: theme.secondaryLabel }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={styles.check}>
        {checked ? <CheckIcon color={theme.accent} /> : null}
      </View>
    </Pressable>
  );
}

/** Label and value; with `onPress` it becomes a picker row with a chevron. */
export function ValueRow({
  label,
  detail,
  value,
  valueColor,
  onPress,
}: RowBaseProps & {
  value: string;
  valueColor?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const content = (
    <>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.label }]}>{label}</Text>
        {detail ? (
          <Text style={[styles.detail, { color: theme.secondaryLabel }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text
        style={[styles.value, { color: valueColor ?? theme.secondaryLabel }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      {onPress ? <ChevronIcon color={theme.tertiaryLabel} /> : null}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: theme.fill } : null,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function ButtonRow({
  label,
  onPress,
  destructive,
  busy,
  chevron,
  detail,
}: RowBaseProps & {
  onPress: () => void;
  destructive?: boolean;
  busy?: boolean;
  chevron?: boolean;
}) {
  const theme = useTheme();
  const color = destructive ? theme.destructive : theme.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: theme.fill } : null,
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: chevron ? theme.label : color }]}>
          {label}
        </Text>
        {detail ? (
          <Text style={[styles.detail, { color: theme.secondaryLabel }]}>
            {detail}
          </Text>
        ) : null}
      </View>
      {busy ? <ActivityIndicator /> : null}
      {chevron && !busy ? <ChevronIcon color={theme.tertiaryLabel} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 28,
  },
  header: {
    fontSize: 13,
    marginHorizontal: 32,
    marginBottom: 7,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  footer: {
    fontSize: 13,
    lineHeight: 18,
    marginHorizontal: 32,
    marginTop: 7,
  },
  row: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  flex: {
    flex: 1,
  },
  check: {
    width: 22,
    alignItems: 'center',
  },
  label: {
    fontSize: 17,
  },
  detail: {
    fontSize: 13,
    lineHeight: 17,
  },
  value: {
    fontSize: 17,
    maxWidth: '60%',
  },
});
