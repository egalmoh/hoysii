import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { useMemo } from 'react';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://api.hoysii.com').replace(/\/$/, '');

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [expoClient({ scheme: 'hoysii', storagePrefix: 'hoysii', storage: SecureStore })],
});

function profile(user) {
  if (!user) return null;
  const parts = (user.name || '').trim().split(/\s+/);
  return {
    ...user,
    fullName: user.name,
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
    imageUrl: user.image,
    primaryEmailAddress: { emailAddress: user.email },
    emailAddresses: [{ emailAddress: user.email }],
  };
}

export function useAuth() {
  const { data, isPending } = authClient.useSession();
  const user = useMemo(() => profile(data?.user), [data?.user]);
  return {
    isLoaded: !isPending,
    isSignedIn: Boolean(data?.user),
    userId: data?.user?.id || null,
    user,
    getToken: () => authClient.getCookie(),
    signOut: () => authClient.signOut(),
  };
}

export function useUser() {
  const { data, isPending } = authClient.useSession();
  const user = useMemo(() => profile(data?.user), [data?.user]);
  return { user, isLoaded: !isPending };
}
