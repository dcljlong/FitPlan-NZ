export const colors = {
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3F4F6',
  primary: '#F97316',
  primaryForeground: '#FFFFFF',
  secondary: '#1E293B',
  secondaryForeground: '#F8FAFC',
  accent: '#FACC15',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  border: '#E2E8F0',
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EF4444',
  transparent: 'transparent',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 9999,
};

export const typography = {
  h1: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -1 },
  h2: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.5 },
  h3: { fontSize: 20, fontWeight: '600' as const },
  bodyLarge: { fontSize: 18, fontWeight: '400' as const },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  caption: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 1.5 },
};

export const shadows = {
  subtle: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
};

export function getStatusColor(indicator: string) {
  switch (indicator) {
    case 'green': return colors.green;
    case 'yellow': return colors.yellow;
    case 'red': return colors.red;
    default: return colors.border;
  }
}

export function getStatusLabel(indicator: string) {
  switch (indicator) {
    case 'green': return 'Under Time';
    case 'yellow': return 'On Track';
    case 'red': return 'Over Time';
    default: return 'No Hours';
  }
}
