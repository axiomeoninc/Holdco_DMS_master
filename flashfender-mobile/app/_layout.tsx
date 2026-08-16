import 'react-native-gesture-handler';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Toaster } from 'sonner-native';
import 'react-native-reanimated';

import { BiometricLockScreen } from '@/components/BiometricLockScreen';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { palette, tokensFor } from '@/constants/tokens';
import { subscribePushNavigation } from '@/lib/push';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

const goldLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.primary,
    background: tokensFor('light').background,
    card: tokensFor('light').surface,
    text: tokensFor('light').text,
    border: tokensFor('light').border,
    notification: palette.primary,
  },
};

const goldDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: palette.primary,
    background: tokensFor('dark').background,
    card: tokensFor('dark').surface,
    text: tokensFor('dark').text,
    border: tokensFor('dark').border,
    notification: palette.primary,
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
          <Toaster />
        </BottomSheetModalProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  const scheme = useColorScheme();
  const { isLoading, isSignedIn, needsUnlock } = useAuth();
  const tokens = tokensFor(scheme);

  useEffect(() => {
    if (!isLoading) {
      void SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => subscribePushNavigation(), []);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.background,
        }}
      >
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  if (needsUnlock) {
    return (
      <ThemeProvider value={scheme === 'dark' ? goldDark : goldLight}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <BiometricLockScreen />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={scheme === 'dark' ? goldDark : goldLight}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="vehicle/[id]"
            options={{ headerShown: true, title: 'Vehicle' }}
          />
          <Stack.Screen
            name="lead/[id]"
            options={{ headerShown: true, title: 'Lead' }}
          />
          <Stack.Screen
            name="customer/[id]"
            options={{ headerShown: true, title: 'Customer' }}
          />
          <Stack.Screen
            name="deals"
            options={{ headerShown: true, title: 'Deals' }}
          />
          <Stack.Screen
            name="deal/[id]"
            options={{ headerShown: true, title: 'Deal' }}
          />
          <Stack.Screen
            name="follow-ups"
            options={{ headerShown: true, title: "Today's follow-ups" }}
          />
          <Stack.Screen
            name="tasks"
            options={{ headerShown: true, title: 'My tasks' }}
          />
          <Stack.Screen
            name="invoices"
            options={{ headerShown: true, title: 'Invoices' }}
          />
          <Stack.Screen
            name="invoice/[id]"
            options={{ headerShown: true, title: 'Invoice' }}
          />
          <Stack.Screen
            name="credit-applications"
            options={{ headerShown: true, title: 'Credit applications' }}
          />
          <Stack.Screen
            name="credit/[id]"
            options={{ headerShown: true, title: 'Credit application' }}
          />
          <Stack.Screen
            name="expenses"
            options={{ headerShown: true, title: 'Expenses' }}
          />
          <Stack.Screen
            name="expense/[id]"
            options={{ headerShown: true, title: 'Expense' }}
          />
          <Stack.Screen
            name="vendors"
            options={{ headerShown: true, title: 'Vendors' }}
          />
          <Stack.Screen
            name="vendor/[id]"
            options={{ headerShown: true, title: 'Vendor' }}
          />
          <Stack.Screen
            name="calendar"
            options={{ headerShown: true, title: 'Calendar' }}
          />
          <Stack.Screen
            name="test-drives"
            options={{ headerShown: true, title: 'Test drives' }}
          />
          <Stack.Screen
            name="test-drive/[id]"
            options={{ headerShown: true, title: 'Test drive' }}
          />
          <Stack.Screen
            name="tickets"
            options={{ headerShown: true, title: 'Tickets' }}
          />
          <Stack.Screen
            name="ticket/[id]"
            options={{ headerShown: true, title: 'Ticket' }}
          />
          <Stack.Screen
            name="service"
            options={{ headerShown: true, title: 'Service' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
