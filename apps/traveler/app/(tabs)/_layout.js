import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuth();
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#489CFC',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FAFAFA',
          borderTopWidth: 0,
          height: 70 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          paddingHorizontal: 56,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 5,
          elevation: 15,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Inter_400Regular',
          fontWeight: '400',
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarItemStyle: {
          gap: 5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Explore',
          tabBarIcon: ({ color }) => (
            <Feather name="search" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          tabBarLabel: 'Trips',
          tabBarIcon: ({ color }) => (
            <Feather name="triangle" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: isSignedIn ? 'Profile' : 'Log in',
          tabBarIcon: ({ color }) => <Feather name="user" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
