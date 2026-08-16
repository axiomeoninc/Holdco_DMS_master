import { useColorScheme as useColorSchemeCore } from 'react-native';

import type { ColorSchemeName } from '@/constants/tokens';

export const useColorScheme = (): ColorSchemeName => {
  const coreScheme = useColorSchemeCore();
  return coreScheme === 'dark' ? 'dark' : 'light';
};
