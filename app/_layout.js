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
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="searchresults" options={{ headerShown: false }} />
        <Stack.Screen name="listingDetails" options={{ headerShown: false }} />
        <Stack.Screen name="(modals)/login" options={{ headerShown: false, presentation: 'transparentModal' }} />
        <Stack.Screen name="(modals)/booking" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="(modals)/payment" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="(modals)/confirmation" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="(modals)/terms" options={{ headerShown: false, presentation: 'transparentModal' }} />
      </Stack>
  );
}
