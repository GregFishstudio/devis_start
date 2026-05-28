import '@/global.css';

import { Platform } from 'react-native';

// Brand palette – dark mode design system
export const ACCENT  = '#B8860B';   // Dark goldenrod – buttons, actions
export const ERROR   = '#F87171';   // Red-400 – errors, delete
export const SUCCESS = '#4ADE80';   // Green-400 – accepted, posted
export const WARNING = '#FBBF24';   // Amber-400 – warning, pending

export const Colors = {
  light: {
    text:               '#0D2A45',
    background:         '#F4F1EA',
    backgroundElement:  '#E0E7EF',
    backgroundSelected: '#C8D5E3',
    textSecondary:      '#4A6580',
  },
  dark: {
    text:               '#F4F1EA',
    background:         '#0D2A45',
    backgroundElement:  '#1A3D5D',
    backgroundSelected: '#234d73',
    textSecondary:      '#A0AEC0',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans:    'system-ui',
    serif:   'ui-serif',
    rounded: 'ui-rounded',
    mono:    'ui-monospace',
  },
  default: {
    sans:    'normal',
    serif:   'serif',
    rounded: 'normal',
    mono:    'monospace',
  },
  web: {
    sans:    'var(--font-display)',
    serif:   'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono:    'var(--font-mono)',
  },
});

export const Spacing = {
  half:  2,
  one:   4,
  two:   8,
  three: 16,
  four:  24,
  five:  32,
  six:   64,
} as const;

export const BottomTabInset  = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
