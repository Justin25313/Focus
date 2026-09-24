import { useColorScheme } from 'react-native';

/** iOS system colors, resolved for light and dark appearance. */
const light = {
  background: '#FFFFFF',
  groupedBackground: '#F2F2F7',
  cell: '#FFFFFF',
  label: '#000000',
  secondaryLabel: 'rgba(60,60,67,0.6)',
  tertiaryLabel: 'rgba(60,60,67,0.3)',
  separator: 'rgba(60,60,67,0.29)',
  fill: 'rgba(118,118,128,0.12)',
  destructive: '#FF3B30',
  accent: '#1E6B57',
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(30,107,87,0.12)',
  barBackground: 'rgba(249,249,249,0.97)',
  webBackground: '#FFFFFF',
};

const dark: typeof light = {
  background: '#000000',
  groupedBackground: '#000000',
  cell: '#1C1C1E',
  label: '#FFFFFF',
  secondaryLabel: 'rgba(235,235,245,0.6)',
  tertiaryLabel: 'rgba(235,235,245,0.3)',
  separator: 'rgba(84,84,88,0.65)',
  fill: 'rgba(118,118,128,0.24)',
  destructive: '#FF453A',
  accent: '#6FD1B2',
  onAccent: '#04241B',
  accentSoft: 'rgba(111,209,178,0.16)',
  barBackground: 'rgba(22,22,24,0.97)',
  webBackground: '#000000',
};

export type Theme = typeof light & { dark: boolean };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark'
    ? { ...dark, dark: true }
    : { ...light, dark: false };
}

/** Height of the Focus tab bar without the home-indicator inset. */
export const TAB_BAR_HEIGHT = 49;
