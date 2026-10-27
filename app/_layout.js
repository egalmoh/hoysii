import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';

import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  if (!loaded) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="searchresults" options={{ headerShown: false }} />
        <Stack.Screen name="listingDetails" options={{ headerShown: false }} />
        <Stack.Screen name="(modals)/login" options={{ headerShown: false, presentation: 'transparentModal' }} />
        <Stack.Screen name="(modals)/booking" options={{ headerShown: false, presentation: 'transparentModal' }} />
        <Stack.Screen name="(modals)/payment" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="(modals)/confirmation" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="(modals)/terms" options={{ headerShown: false, presentation: 'transparentModal' }} />
      </Stack>
    </ClerkProvider>
  );
}
