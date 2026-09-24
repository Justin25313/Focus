import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = { color: string; size?: number; filled?: boolean };

const stroke = (color: string) => ({
  stroke: color,
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
});

export function HomeIcon({ color, size = 26, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.8H9.2v5.8H5A1.5 1.5 0 0 1 3.5 19z"
        {...stroke(color)}
        fill={filled ? color : 'none'}
      />
    </Svg>
  );
}

export function SearchIcon({ color, size = 26, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle
        cx={10.8}
        cy={10.8}
        r={6.8}
        {...stroke(color)}
        strokeWidth={filled ? 2.6 : 1.9}
      />
      <Path
        d="m16 16 4.5 4.5"
        {...stroke(color)}
        strokeWidth={filled ? 2.6 : 1.9}
      />
    </Svg>
  );
}

export function MessageIcon({ color, size = 26, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M20.8 3.2 3.6 9.6l7 3.1 3.1 7.1z"
        {...stroke(color)}
        fill={filled ? color : 'none'}
      />
      {filled ? null : <Path d="m20.8 3.2-10.2 9.5" {...stroke(color)} />}
    </Svg>
  );
}

/** Rounded square with a play triangle. */
export function ReelsIcon({ color, size = 26, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7 3.5h10A3.5 3.5 0 0 1 20.5 7v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5z"
        {...stroke(color)}
        strokeWidth={filled ? 2.3 : 1.9}
      />
      <Path d="m10 8.6 5.4 3.4-5.4 3.4z" fill={color} />
    </Svg>
  );
}

/** Person in a circle, as in Instagram's tab bar. */
export function ProfileIcon({ color, size = 26, filled }: IconProps) {
  const width = filled ? 2.3 : 1.9;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9.6} {...stroke(color)} strokeWidth={width} />
      <Circle cx={12} cy={10} r={3.4} {...stroke(color)} strokeWidth={width} />
      <Path
        d="M6.2 18.9c1.2-2.4 3.3-3.7 5.8-3.7s4.6 1.3 5.8 3.7"
        {...stroke(color)}
        strokeWidth={width}
      />
    </Svg>
  );
}

/** The Focus mark: a ring with a centred point. */
export function FocusIcon({ color, size = 26, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle
        cx={12}
        cy={12}
        r={8.3}
        {...stroke(color)}
        strokeWidth={filled ? 2.5 : 1.9}
      />
      <Circle cx={12} cy={12} r={2.9} fill={color} />
    </Svg>
  );
}

export function ShieldIcon({ color, size = 56 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.8 19.5 5.6v5.9c0 4.6-3.1 8-7.5 9.7-4.4-1.7-7.5-5.1-7.5-9.7V5.6z"
        {...stroke(color)}
        strokeWidth={1.5}
      />
      <Path d="M8.6 12h6.8" {...stroke(color)} strokeWidth={1.8} />
    </Svg>
  );
}

export function OfflineIcon({ color, size = 56 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2.5 8.8a14 14 0 0 1 19 0"
        {...stroke(color)}
        strokeWidth={1.5}
      />
      <Path
        d="M5.6 12.2a9.5 9.5 0 0 1 12.8 0"
        {...stroke(color)}
        strokeWidth={1.5}
      />
      <Path
        d="M8.8 15.6a5 5 0 0 1 6.4 0"
        {...stroke(color)}
        strokeWidth={1.5}
      />
      <Circle cx={12} cy={19} r={1.1} fill={color} />
      <Path d="m3.5 3.5 17 17" {...stroke(color)} strokeWidth={1.5} />
    </Svg>
  );
}

export function ChevronIcon({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="m9 5 7 7-7 7" {...stroke(color)} strokeWidth={2.6} />
    </Svg>
  );
}

export function CheckIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="m4.5 12.5 5 5 10-11" {...stroke(color)} strokeWidth={2.6} />
    </Svg>
  );
}

export function VerifiedIcon({ color, size = 14 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill={color} />
      <Path d="m7.5 12.3 3 3 6-6.3" {...stroke('#FFFFFF')} strokeWidth={2.4} />
    </Svg>
  );
}

export function PencilIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M15.8 4.6a2.1 2.1 0 0 1 3 0l.6.6a2.1 2.1 0 0 1 0 3L8.6 19 4 20l1-4.6z"
        {...stroke(color)}
        strokeWidth={2.2}
      />
      <Path d="m14 6.4 3.6 3.6" {...stroke(color)} strokeWidth={2.2} />
    </Svg>
  );
}

/** "Use this suggestion": arrow to the top left, as in YouTube's search. */
export function FillIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M18 18 6.5 6.5M6.5 15V6.5H15"
        {...stroke(color)}
        strokeWidth={2}
      />
    </Svg>
  );
}

export function MenuIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 6.5h16M4 12h16M4 17.5h16"
        {...stroke(color)}
        strokeWidth={2}
      />
    </Svg>
  );
}

export function PlusIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 4.5v15M4.5 12h15" {...stroke(color)} strokeWidth={2} />
    </Svg>
  );
}

export function BackIcon({ color, size = 22 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M15 4.5 7.5 12l7.5 7.5" {...stroke(color)} strokeWidth={2.2} />
    </Svg>
  );
}
