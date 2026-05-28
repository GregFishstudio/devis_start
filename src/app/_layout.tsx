import { DarkTheme, DefaultTheme, ThemeProvider, Slot, router, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { queryClient } from '@/lib/query-client';

function Navigator() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    const inCompanySetup = segments[1] === 'company-setup';
    if (!session && !inAuth) {
      router.replace('/(auth)/login');
    } else if (session && !profile?.company_id && !inCompanySetup) {
      router.replace('/(auth)/company-setup');
    } else if (session && profile?.company_id && inAuth) {
      router.replace('/');
    }
  }, [session, profile, loading, segments]);

  const inAuth = segments[0] === '(auth)';
  const showTabs = !loading && !!session && !!profile?.company_id && !inAuth;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {showTabs ? <AppTabs /> : <Slot />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Navigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
