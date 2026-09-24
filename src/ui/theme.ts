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
  barBackground: 'rgba(250,250,250,0.72)',
  barSelected: 'rgba(0,0,0,0.07)',
  barBorder: 'rgba(0,0,0,0.06)',
  webBackground: '#FFFFFF',
  skeleton: '#EDEDF0',
  // Validated for the light surface (lightness band, chroma, contrast).
  chartBar: '#12875F',
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
  barBackground: 'rgba(30,30,32,0.6)',
  barSelected: 'rgba(255,255,255,0.12)',
  barBorder: 'rgba(255,255,255,0.08)',
  webBackground: '#000000',
  skeleton: '#1F1F22',
  // Validated for the dark surface.
  chartBar: '#34A984',
};

export type Theme = typeof light & { dark: boolean };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark'
    ? { ...dark, dark: true }
    : { ...light, dark: false };
}

/** The floating tab bar: a glass pill above the home indicator. */
export const TAB_BAR_PILL_HEIGHT = 58;

/** Distance of the pill from the bottom edge (23 pt on iPhone 15 Pro). */
export function tabBarBottom(insetBottom: number): number {
  return Math.max(insetBottom - 11, 12);
}

/** Space that scrolling content keeps free below it for the pill. */
export function tabBarSpace(insetBottom: number): number {
  return TAB_BAR_PILL_HEIGHT + tabBarBottom(insetBottom) + 12;
}
