/**
 * FlashFender Gold UI tokens.
 * Primary bolt cyan, hairline borders. No violet, indigo, glass, or gradients.
 */

export const palette = {
  primary: '#00AEEF',
  primaryPressed: '#008FCB',
  primarySoft: 'rgba(0, 174, 239, 0.10)',
  primaryHairline: 'rgba(0, 174, 239, 0.35)',
} as const;

export const lightTokens = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#1F2937',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  danger: '#B91C1C',
  dangerSoft: '#FEF2F2',
  tabInactive: '#9CA3AF',
} as const;

export const darkTokens = {
  background: '#111827',
  surface: '#1F2937',
  text: '#F9FAFB',
  textMuted: '#9CA3AF',
  border: '#374151',
  danger: '#FCA5A5',
  dangerSoft: '#7F1D1D',
  tabInactive: '#6B7280',
} as const;

export type ColorSchemeName = 'light' | 'dark';

export type ThemeTokens = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  danger: string;
  dangerSoft: string;
  tabInactive: string;
};

export function tokensFor(scheme: ColorSchemeName): ThemeTokens {
  return scheme === 'dark' ? darkTokens : lightTokens;
}
