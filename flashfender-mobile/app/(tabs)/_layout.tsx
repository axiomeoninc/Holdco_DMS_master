import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';

import { SpotlightButton } from '@/components/SpotlightModal';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import { palette, tokensFor } from '@/constants/tokens';

export default function TabLayout() {
  const scheme = useColorScheme();
  const tokens = tokensFor(scheme);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: tokens.tabInactive,
        tabBarStyle: {
          backgroundColor: tokens.surface,
          borderTopColor: tokens.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        headerStyle: {
          backgroundColor: tokens.surface,
        },
        headerTitleStyle: {
          color: tokens.text,
          fontWeight: '600',
        },
        headerShadowVisible: false,
        headerTintColor: tokens.text,
        headerRight: () => <SpotlightButton />,
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Stock',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pipeline"
        options={{
          title: 'Pipeline',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="funnel-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={Platform.OS === 'ios' ? 'ellipsis-horizontal' : 'menu-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
