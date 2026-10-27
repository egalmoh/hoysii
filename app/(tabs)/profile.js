import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Not signed in - show login prompt
  if (!isSignedIn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <View style={styles.notSignedInContainer}>
          {/* Profile Icon */}
          <View style={styles.avatarPlaceholder}>
            <Feather name="user" size={48} color="#6B7280" />
          </View>

          <Text style={styles.welcomeTitle}>Welcome to Hoysii</Text>
          <Text style={styles.welcomeSubtitle}>
            Sign in to manage your bookings, and get verified hotels.
          </Text>

          <TouchableOpacity
            style={styles.loginButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(modals)/login')}
          >
            <Text style={styles.loginButtonText}>Log in or Sign up</Text>
          </TouchableOpacity>

          {/* Features list */}
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="shield-check" size={24} color="#489CFC" />
              <Text style={styles.featureText}>Book verified hotels</Text>
            </View>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="calendar-check" size={24} color="#489CFC" />
              <Text style={styles.featureText}>Manage your trips</Text>
            </View>
            {/* <View style={styles.featureItem}>
              <MaterialCommunityIcons name="heart-outline" size={24} color="#489CFC" />
              <Text style={styles.featureText}>Save favorite stays</Text>
            </View> */}
          </View>
        </View>
      </View>
    );
  }

  // Signed in - show profile
  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.headerTitle}>Profile</Text>

        {/* User Info Card with Sign Out */}
        <View style={styles.userCard}>
          {user?.imageUrl ? (
            <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>
                {user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
          
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user?.firstName || 'User'}
            </Text>
            <Text style={styles.userEmail}>
              {user?.emailAddresses?.[0]?.emailAddress || ''}
            </Text>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity 
            style={styles.signOutButton}
            activeOpacity={0.7}
            onPress={handleSignOut}
          >
            <Feather name="log-out" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {/* <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Feather name="user" size={20} color="#374151" />
              <Text style={styles.menuItemText}>Personal Information</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Feather name="credit-card" size={20} color="#374151" />
              <Text style={styles.menuItemText}>Payment Methods</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity> */}

          <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Feather name="bell" size={20} color="#374151" />
              <Text style={styles.menuItemText}>Notifications</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {/* <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuItemLeft}>
              <Feather name="help-circle" size={20} color="#374151" />
              <Text style={styles.menuItemText}>Help & Support</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity> */}
        </View>

        {/* Help & Support Section */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Help & Support</Text>
          <TouchableOpacity 
            style={styles.whatsappButton}
            activeOpacity={0.8}
            onPress={() => {
              // Open WhatsApp with your business number
              const phoneNumber = '+252907275534'; // Replace with actual number
              const url = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`;
              Linking.openURL(url);
            }}
          >
            <Image
              source={require('../../assets/Images/whatsapp.png')}
              style={styles.whatsappIcon}
              resizeMode="contain"
            />
            <Text style={styles.whatsappText}>Call Us on Whatsapp</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <Text style={styles.versionText}>Hoysii v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 24,
    fontFamily: 'Inter_700Bold',
  },

  // Not signed in styles
  notSignedInContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Inter_700Bold',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    fontFamily: 'Inter_400Regular',
  },
  loginButton: {
    backgroundColor: '#489CFC',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_500Medium',
  },
  featuresList: {
    width: '100%',
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter_400Regular',
  },

  // Signed in styles
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#489CFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'Inter_500Medium',
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter_400Regular',
  },
  signOutButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 20,
  },
  signOutText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter_400Regular',
  },
  helpSection: {
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  helpTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    textAlign: 'center',
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingVertical: 13,
    paddingHorizontal: 25,
    width: 320,
    height: 75,
    gap: 10,
  },
  whatsappIcon: {
    width: 45,
    height: 45,
  },
  whatsappText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    lineHeight: 19,
  },
});
