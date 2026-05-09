// Pink/brand accent stays the same across both themes
const PINK = '#FF4D8D';
const PINK_DIM = '#CC3066';
const PINK_GLOW = 'rgba(255, 77, 141, 0.15)';
const PINK_BORDER = 'rgba(255, 77, 141, 0.3)';

export const DarkColors = {
  background: '#0A0507',
  backgroundSecondary: '#140A10',
  backgroundCard: '#1E0F18',
  backgroundInput: '#140A10',

  navy: '#1A0E14',
  navyLight: '#2A1520',

  neonBlue: PINK,
  neonBlueDim: PINK_DIM,
  neonBlueGlow: PINK_GLOW,
  neonBlueBorder: PINK_BORDER,

  white: '#FFFFFF',
  textPrimary: '#FDE8F0',
  textSecondary: '#D67EB0',
  textMuted: '#994A75',

  success: '#00E676',
  successDim: 'rgba(0, 230, 118, 0.15)',
  warning: '#FFB300',
  error: '#FF4444',
  errorDim: 'rgba(255, 68, 68, 0.15)',

  gold: '#FFD700',
  goldDim: '#CC9900',

  border: 'rgba(255, 77, 141, 0.15)',
  borderLight: 'rgba(255, 255, 255, 0.06)',

  overlay: 'rgba(10, 5, 7, 0.85)',
  tabBar: 'rgba(10, 5, 7, 0.97)',
};

export const LightColors = {
  background: '#FFFFFF',
  backgroundSecondary: '#F7F0F4',
  backgroundCard: '#FDF5F8',
  backgroundInput: '#F7F0F4',

  navy: '#F2E6ED',
  navyLight: '#EDD8E5',

  neonBlue: PINK,
  neonBlueDim: PINK_DIM,
  neonBlueGlow: PINK_GLOW,
  neonBlueBorder: PINK_BORDER,

  white: '#FFFFFF',
  textPrimary: '#1A0A14',
  textSecondary: '#5C2A42',
  textMuted: '#9E5070',

  success: '#00A854',
  successDim: 'rgba(0, 168, 84, 0.12)',
  warning: '#C07800',
  error: '#D42020',
  errorDim: 'rgba(212, 32, 32, 0.12)',

  gold: '#B8860B',
  goldDim: '#8B6508',

  border: 'rgba(255, 77, 141, 0.18)',
  borderLight: 'rgba(0, 0, 0, 0.06)',

  overlay: 'rgba(255, 255, 255, 0.92)',
  tabBar: 'rgba(255, 255, 255, 0.97)',
};

// Default export kept as dark for backwards-compat; use useAppTheme() at runtime
export const Colors = DarkColors;

export const Spacing = {
  xs: 3,
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 36,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 18,
  full: 999,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  hero: 28,
};

export const Shadow = {
  neonBlue: {
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  neonBlueSubtle: {
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
};
