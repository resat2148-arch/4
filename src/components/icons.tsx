import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

// Outline icons drawn on a 24x24 grid, matching the prototype.
function Outline({
  size = 22,
  color = colors.text,
  strokeWidth = 1.6,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}>
      {children}
    </Svg>
  );
}

export function BanIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M5.6 5.6l12.8 12.8" />
    </Outline>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <Rect x="9" y="3" width="6" height="11" rx="3" />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Outline>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </Outline>
  );
}

export function HeadphonesIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <Path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <Rect x="3" y="14" width="4" height="7" rx="1.5" />
      <Rect x="17" y="14" width="4" height="7" rx="1.5" />
    </Outline>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <Path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" />
    </Outline>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <Rect x="3" y="5" width="18" height="14" rx="2" />
      <Path d="M3 7l9 6 9-6" />
    </Outline>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Outline>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <Outline strokeWidth={1.8} {...props}>
      <Path d="M15 5l-7 7 7 7" />
    </Outline>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <Outline size={18} {...props}>
      <Path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </Outline>
  );
}

// Filled glyphs for playback controls.
export function PlayIcon({ size = 28, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d="M7 4.5l12 7.5-12 7.5V4.5z" fill={color} />
    </Svg>
  );
}

export function PauseIcon({ size = 28, color = colors.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Rect x="6" y="5" width="4" height="14" rx="1" fill={color} />
      <Rect x="14" y="5" width="4" height="14" rx="1" fill={color} />
    </Svg>
  );
}
