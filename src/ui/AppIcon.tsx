import React from 'react';
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { ServiceId } from '../services/services';
import { useTheme } from './theme';

/** Home-screen style app icon (squircle), drawn after the apps' own icons. */
export function AppIcon({ id, size = 62 }: { id: ServiceId; size?: number }) {
  const theme = useTheme();
  if (id === 'instagram') {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient
            id="ig"
            cx="28"
            cy="108"
            r="120"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor="#FFDD55" />
            <Stop offset="0.1" stopColor="#FFDD55" />
            <Stop offset="0.5" stopColor="#FF543E" />
            <Stop offset="0.72" stopColor="#C837AB" />
            <Stop offset="1" stopColor="#3771C8" />
          </RadialGradient>
        </Defs>
        <Rect width={100} height={100} rx={22.5} fill="url(#ig)" />
        <Rect
          x={21}
          y={21}
          width={58}
          height={58}
          rx={17}
          stroke="#FFFFFF"
          strokeWidth={6.5}
          fill="none"
        />
        <Circle
          cx={50}
          cy={50}
          r={13.5}
          stroke="#FFFFFF"
          strokeWidth={6.5}
          fill="none"
        />
        <Circle cx={66.5} cy={33.5} r={4.3} fill="#FFFFFF" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect
        x={0.5}
        y={0.5}
        width={99}
        height={99}
        rx={22}
        fill="#FFFFFF"
        stroke={theme.dark ? 'none' : 'rgba(0,0,0,0.1)'}
        strokeWidth={1}
      />
      <Path
        d="M84.2 36.6a9 9 0 0 0-6.3-6.4C72.3 28.7 50 28.7 50 28.7s-22.3 0-27.9 1.5a9 9 0 0 0-6.3 6.4C14.3 42.2 14.3 52 14.3 52s0 9.8 1.5 15.4a9 9 0 0 0 6.3 6.4c5.6 1.5 27.9 1.5 27.9 1.5s22.3 0 27.9-1.5a9 9 0 0 0 6.3-6.4c1.5-5.6 1.5-15.4 1.5-15.4s0-9.8-1.5-15.4z"
        fill="#FF0000"
      />
      <Path d="M42.9 62.1 61.4 52 42.9 41.9z" fill="#FFFFFF" />
    </Svg>
  );
}
