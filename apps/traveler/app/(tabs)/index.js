import { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../lib/auth';
import * as WebBrowser from 'expo-web-browser'; // Ensure WebBrowser is ready if needed, though usually handled in root
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import { api } from '../../lib/api';
import { ActivityIndicator } from 'react-native';
import HotelCard from '../../components/HotelCard';
import PopularStayCard from '../../components/PopularStayCard';
import WelcomePopup from '../../components/WelcomePopup';
import SearchModal from '../../components/SearchModal';
import { StatusBar } from 'expo-status-bar';

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { userId } = useAuth();
  const padding = 40;
  const gap = 16;
  const cardWidth = Math.min(191, (width - padding - gap) / 2);
  const compactTrustBadges = width < 360;

  // Search modal state
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(null); // 'location', 'dates', 'people'
  const [headerHeight, setHeaderHeight] = useState(0);
  const [searchData, setSearchData] = useState({
    location: null,
    dates: null,
    guests: null,
  });

  // Data state
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch hotel inventory from the Worker API.
  useEffect(() => {
    const fetchHotels = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await api
          .from('hotels')
          .select('*');
        
        if (error) {
          console.error('Hotel query error:', JSON.stringify({
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          }));
          throw error;
        }
        setHotels(data || []);
      } catch (error) {
        console.error('Error fetching hotels:', error?.message || JSON.stringify(error));
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, [userId]); // Refetch when userId changes (e.g. login/logout)

  // Filter hotels: verified AND rating >= 4.5
  const recommendedHotels = hotels.filter(
    (hotel) => hotel.rating >= 4.5
  );

  // Scroll tracking
  const lastScrollY = useRef(0);
  const headerVisible = useSharedValue(1);

  // Hide badges when search modal is open
  useEffect(() => {
    if (searchModalVisible) {
      headerVisible.value = withTiming(0, { duration: 200 });
    } else {
      headerVisible.value = withTiming(1, { duration: 200 });
    }
  }, [searchModalVisible]);

  // Handle tab press when modal is already open
  const handleTabPress = (step) => {
    setCurrentStep(step);
    if (!searchModalVisible) {
      setSearchModalVisible(true);
    }
  };

  const handleScroll = (event) => {
    // Don't handle scroll-based hiding when modal is open - but keep tabs visible
    if (searchModalVisible) return;

    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDiff = currentScrollY - lastScrollY.current;

    // Only trigger after scrolling past 50px
    if (currentScrollY > 50) {
      if (scrollDiff > 0) {
        // Scrolling DOWN - hide header elements
        headerVisible.value = withTiming(0, { duration: 200 });
      } else if (scrollDiff < -5) {
        // Scrolling UP - show header elements
        headerVisible.value = withTiming(1, { duration: 200 });
      }
    } else {
      // At top - always show
      headerVisible.value = withTiming(1, { duration: 200 });
    }

    lastScrollY.current = currentScrollY;
  };

  const badgesAnimatedStyle = useAnimatedStyle(() => ({
    opacity: headerVisible.value,
    height: interpolate(headerVisible.value, [0, 1], [0, 34], Extrapolation.CLAMP),
    marginTop: interpolate(headerVisible.value, [0, 1], [0, 20], Extrapolation.CLAMP),
    overflow: 'hidden',
  }));

  const getGuestText = () => {
    if (!searchData.guests) return 'People';
    const total = (searchData.guests.adults || 0) + (searchData.guests.children || 0);
    return `${total} Guest${total > 1 ? 's' : ''}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header with Gradient */}
      <View
        style={styles.headerWrapper}
        onLayout={({ nativeEvent }) => setHeaderHeight(nativeEvent.layout.height)}
      >
        <LinearGradient
          colors={['#D6EBFF90', '#FFFFFF00']}
          locations={[0, 0.3]}

          start={{ x: 0.3, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.header, { paddingTop: Math.max(insets.top, 16) + 12 }]}
        >
        {/* Search Bar */}
        <View style={[styles.searchBar, searchModalVisible && styles.searchBarModalOpen]}>
          <View style={styles.searchTabsContainer}>
            {/* Location Tab */}
            <TouchableOpacity
              onPress={() => handleTabPress('location')}
              style={[
                styles.searchTab,
                currentStep === 'location' && searchModalVisible && styles.searchTabActive
              ]}
            >
              <Text style={styles.searchTabText} numberOfLines={1}>
                {searchData.location ? searchData.location.name : 'Location'}
              </Text>
            </TouchableOpacity>

            <View style={styles.tabDivider} />

            {/* Dates Tab */}
            <TouchableOpacity
              onPress={() => handleTabPress('dates')}
              style={[
                styles.searchTab,
                currentStep === 'dates' && searchModalVisible && styles.searchTabActive
              ]}
            >
              <Text style={styles.searchTabText} numberOfLines={1}>
                {searchData.dates?.checkIn || 'Dates'}
              </Text>
            </TouchableOpacity>

            <View style={styles.tabDivider} />

            {/* People Tab */}
            <TouchableOpacity
              onPress={() => handleTabPress('people')}
              style={[
                styles.searchTab,
                currentStep === 'people' && searchModalVisible && styles.searchTabActive
              ]}
            >
              <Text style={styles.searchTabText} numberOfLines={1}>
                {getGuestText()}
              </Text>
            </TouchableOpacity>
          </View>

          {!searchModalVisible && (
            <TouchableOpacity
              onPress={() => {
                  router.push({
                    pathname: '/searchresults',
                    params: {
                      locationName: searchData.location?.name || '',
                      checkIn: searchData.dates?.checkIn || 'select dates',
                      checkOut: searchData.dates?.checkOut || '',
                      adults: String(searchData.guests?.adults || '0'),
                      children: String(searchData.guests?.children || '0'),
                    },
                  });
              }}
              style={styles.searchButton}
            >
              <Feather name="search" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* Trust Badges - Animated */}
        <Animated.View style={[styles.badgesContainer, badgesAnimatedStyle]}>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="shield-check" size={16} color="#489CFC" />
            <Text style={styles.badgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {compactTrustBadges ? 'Verified' : 'Physically Verified'}
            </Text>
          </View>

          <View style={styles.badge}>
            <MaterialCommunityIcons name="lock" size={14} color="#489CFC" />
            <Text style={styles.badgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {compactTrustBadges ? 'Secure' : 'High Security'}
            </Text>
          </View>

          <View style={styles.badge}>
            <MaterialCommunityIcons name="checkbox-marked-circle" size={16} color="#489CFC" />
            <Text style={styles.badgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              Safe Booking
            </Text>
          </View>
        </Animated.View>
        </LinearGradient>
      </View>

      {/* Main Content Area */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Recommended Section */}
        <View style={styles.recommendedSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommended by hoysii</Text>
          </View>

          <Animated.ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
            decelerationRate={0.9}
            scrollEventThrottle={16}
            nestedScrollEnabled={true}
          >
            {loading ? (
               <View style={{ padding: 20 }}>
                 <ActivityIndicator size="large" color="#489CFC" />
               </View>
            ) : recommendedHotels.length === 0 ? (
               <View style={{ padding: 20 }}>
                 <Text style={{ color: '#6B7280' }}>No recommended hotels found.</Text>
               </View>
            ) : (
            recommendedHotels.map((hotel, index) => (
              <HotelCard 
                key={hotel.id} 
                hotel={hotel} 
                index={index}
                onPress={() => router.push(`/listingDetails/${hotel.id}`)}
              />
            )))}
          </Animated.ScrollView>
        </View>

        {/* Popular Stays Section */}
        <View style={styles.popularSection}>
          <Text style={styles.sectionTitle}>Popular Stays</Text>

          <View style={styles.popularGrid}>
            {loading ? (
              <ActivityIndicator size="large" color="#489CFC" />
            ) : (
              hotels.map((hotel, index) => (
              <PopularStayCard 
                key={hotel.id} 
                hotel={hotel} 
                index={index}
                cardWidth={cardWidth}
                onPress={() => router.push(`/listingDetails/${hotel.id}`)}
              />
            )))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <WelcomePopup />
      
      <SearchModal
        visible={searchModalVisible}
        currentStep={currentStep}
        searchData={searchData}
        headerHeight={headerHeight}
        onCompleteSearch={(finalData) => {
          // Ensure local state reflects what we pass to results screen
          setSearchData(finalData);

          const locationName = finalData.location?.name || '';
          const checkIn = finalData.dates?.checkIn || '';
          const checkOut = finalData.dates?.checkOut || '';
          const adults = finalData.guests?.adults ?? 1;
          const children = finalData.guests?.children ?? 0;

          router.push({
            pathname: '/searchresults',
            params: {
              locationName,
              checkIn,
              checkOut,
              adults: String(adults),
              children: String(children),
            },
          });
        }}
        onClose={() => {
          setSearchModalVisible(false);
          setCurrentStep(null);
        }}
        onNext={(nextStep) => {
          if (nextStep === 'search') {
            setSearchModalVisible(false);
            setCurrentStep(null);
          } else {
            setCurrentStep(nextStep);
          }
        }}
        onUpdateSearchData={(data) => {
          setSearchData(prev => ({ ...prev, ...data }));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerWrapper: {
    backgroundColor: '#FAFAFA',
    shadowColor: '#00000075',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  searchBar: {
    backgroundColor: '#F9F9F9',
    borderRadius: 36,
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.1)',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2},
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 10,
  },

  searchBarModalOpen: {
    zIndex: 200, // Ensure tabs are above modal
    elevation: 20,
  },
  searchTabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    zIndex: 300,
  },
  searchTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 25,
  },
  searchTabActive: {
    backgroundColor: '#E5E6E8',
  },
  searchTabText: {
    color: '#6B7280',
    fontSize: 15,
  },
  tabDivider: {
    width: 1,
    height: 35,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
  },
  searchButton: {
    backgroundColor: '#489CFC',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 20,
  },
  badgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  badge: {
    width: '31.6%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(72, 156, 252, 0.1)',
    borderWidth: 0.5,
    borderColor: '#489CFC',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  badgeText: {
    flexShrink: 1,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#111827',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 15, // Space for bottom tab bar (70px height + 20px padding)
  },
  recommendedSection: {
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: '#111827', 
    fontFamily: 'Inter_500Medium',
  },
  popularSection: {
    paddingTop: 32,
    paddingHorizontal: 20,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
    rowGap: 16,
  },
});
