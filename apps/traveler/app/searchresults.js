import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { api } from '../lib/api';
import { ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import HotelCard from '../components/HotelCard';
import SearchModal from '../components/SearchModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { Easing, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

function formatDateLabel(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const month = monthNames[date.getMonth()];
  const day = date.getDate();

  return `${month} ${day}`;
}

export default function SearchResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const locationName = typeof params.locationName === 'string' ? params.locationName : '';
  const checkIn = typeof params.checkIn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.checkIn) ? params.checkIn : '';
  const checkOut = typeof params.checkOut === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.checkOut) ? params.checkOut : '';
  const adultsParam = typeof params.adults === 'string' ? params.adults : '1';
  const childrenParam = typeof params.children === 'string' ? params.children : '0';

  const adults = parseInt(adultsParam, 10) || 1;
  const children = parseInt(childrenParam, 10) || 0;

  const [loading, setLoading] = useState(true);
  const [hotels, setHotels] = useState([]);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchBarExpanded, setSearchBarExpanded] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [editSearchData, setEditSearchData] = useState(null);
  const expansion = useSharedValue(0);

  const leftSlotStyle = useAnimatedStyle(() => ({
    width: interpolate(expansion.value, [0, 1], [30, 0], Extrapolation.CLAMP),
    marginRight: interpolate(expansion.value, [0, 1], [12, 0], Extrapolation.CLAMP),
    opacity: 1 - expansion.value,
  }));
  const rightSlotStyle = useAnimatedStyle(() => ({
    width: interpolate(expansion.value, [0, 1], [30, 0], Extrapolation.CLAMP),
    marginLeft: interpolate(expansion.value, [0, 1], [12, 0], Extrapolation.CLAMP),
    opacity: 1 - expansion.value,
  }));
  const summaryStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0, 0.45], [1, 0], Extrapolation.CLAMP),
  }));
  const tabsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expansion.value, [0.45, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const openSearchEditor = () => {
    setEditSearchData({
      location: locationName && locationName.toLowerCase() !== 'any' ? { name: locationName, region: '' } : null,
      dates: { checkIn: checkIn || null, checkOut: checkOut || null },
      guests: { adults, children },
    });
    setCurrentStep('location');
    setSearchBarExpanded(true);
    expansion.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setSearchModalVisible)(true);
    });
  };

  const closeSearchEditor = () => {
    setSearchModalVisible(false);
    setSearchBarExpanded(false);
    setCurrentStep(null);
    expansion.value = withTiming(0, { duration: 260, easing: Easing.inOut(Easing.cubic) });
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHotels([]);
    const fetchHotels = async () => {
      try {
        let query = api.from('hotels').select('*');
        
        if (locationName && locationName.toLowerCase() !== 'any') {
          // Use ilike for case-insensitive partial match on city
          query = query.ilike('city', `%${locationName}%`);
        }
        if (checkIn && checkOut) {
          query = query.eq('check_in', checkIn).eq('check_out', checkOut).eq('adults', adults);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        if (active) setHotels(data || []);
      } catch (error) {
        console.error('Error fetching search results:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchHotels();
    return () => { active = false; };
  }, [locationName, checkIn, checkOut, adults]);

  const titleLocation = locationName ? `${locationName} Stays` : 'Somalia Stays';

  const startLabel = formatDateLabel(checkIn);
  const endLabel = formatDateLabel(checkOut);

  let dateLabel = 'Dates';
  if (startLabel && endLabel) {
    dateLabel = `${startLabel} - ${endLabel}`;
  } else if (startLabel) {
    dateLabel = startLabel;
  }

  const adultsLabel = `${adults} Adult${adults > 1 ? 's' : ''}`;

  const filteredHotels = hotels;

  const resultsCardWidth = Math.min(400, width - insets.left - insets.right - 40);
  const resultsCardHeight = Math.round(resultsCardWidth * (399 / 400));

  return (
    <View 
      style={styles.container}>
      <StatusBar style="dark" />
      {/* Gradient Header with Summary Pill */}
      <View style={styles.headerWrapper} onLayout={({ nativeEvent }) => setHeaderHeight(nativeEvent.layout.height)}>
        <LinearGradient
          colors={['#D6EBFF', '#FFFFFF']}
          locations={[0, 0.4]}

          start={{ x: 0.1, y: -0.3 }}
          end={{ x: 0, y: 1 }}
          style={[styles.headerGradient, {
            paddingTop: insets.top + 12,
            paddingLeft: insets.left + 20,
            paddingRight: insets.right + 20,
          }]}
        >
          <View style={styles.headerRow}>
            <Animated.View style={[styles.sideSlot, leftSlotStyle]} pointerEvents={searchBarExpanded ? 'none' : 'auto'}>
              <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} activeOpacity={0.7}>
                <Feather name="arrow-left" size={24} color="#6B7280" />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={styles.summaryPill}>
              <Animated.View style={[styles.summaryLayer, summaryStyle]} pointerEvents={searchBarExpanded ? 'none' : 'auto'}>
                <TouchableOpacity
                  onPress={openSearchEditor}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Edit search"
                  style={styles.summaryContent}
                >
                  <Text style={styles.locationTitle} numberOfLines={1}>{titleLocation}</Text>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summarySubText}>{dateLabel}</Text>
                    <View style={styles.summaryDivider} />
                    <Text style={styles.summarySubText}>{adultsLabel}</Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={[styles.searchTabsContainer, tabsStyle]} pointerEvents={searchBarExpanded ? 'auto' : 'none'}>
                <TouchableOpacity onPress={() => setCurrentStep('location')} style={[styles.searchTab, currentStep === 'location' && styles.searchTabActive]}>
                  <Text style={styles.searchTabText} numberOfLines={1}>{editSearchData?.location?.name || 'Location'}</Text>
                </TouchableOpacity>
                <View style={styles.tabDivider} />
                <TouchableOpacity onPress={() => setCurrentStep('dates')} style={[styles.searchTab, currentStep === 'dates' && styles.searchTabActive]}>
                  <Text style={styles.searchTabText} numberOfLines={1}>{formatDateLabel(editSearchData?.dates?.checkIn) || 'Dates'}</Text>
                </TouchableOpacity>
                <View style={styles.tabDivider} />
                <TouchableOpacity onPress={() => setCurrentStep('people')} style={[styles.searchTab, currentStep === 'people' && styles.searchTabActive]}>
                  <Text style={styles.searchTabText} numberOfLines={1}>People</Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
            <Animated.View style={[styles.sideSlot, rightSlotStyle]} pointerEvents="none" accessible={false} accessibilityElementsHidden>
              <Feather name="filter" size={24} color="transparent" />
            </Animated.View>
          </View>
        </LinearGradient>
      </View>

      {/* Hotels List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, {
          paddingBottom: insets.bottom + 24,
          paddingLeft: insets.left + 20,
          paddingRight: insets.right + 20,
        }]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
           <View style={{ marginTop: 50 }}>
             <ActivityIndicator size="large" color="#489CFC" />
           </View>
        ) : filteredHotels.length === 0 ? (
           <View style={{ marginTop: 50 }}>
             <Text style={{ color: '#6B7280' }}>{checkIn && checkOut ? 'No rooms available for those dates. Try other dates.' : `No hotels found in ${locationName || 'this area'}.`}</Text>
           </View>
        ) : (
        filteredHotels.map((hotel, index) => (
          <View key={hotel.id} style={styles.cardWrapper}>
            <HotelCard 
              hotel={hotel} 
              index={index} 
              cardWidth={resultsCardWidth}
              cardHeight={resultsCardHeight}
              onPress={() => router.push({
                pathname: `/listingDetails/${hotel.id}`,
                params: { checkIn, checkOut, adults: adultsParam, children: childrenParam }
              })}
            />
          </View>
        )))}
      </ScrollView>
      <SearchModal
        visible={searchModalVisible}
        currentStep={currentStep}
        searchData={editSearchData}
        allowEmptyLocation
        headerHeight={headerHeight}
        onClose={closeSearchEditor}
        onNext={(step) => {
          if (step === 'search') {
            closeSearchEditor();
          } else {
            setCurrentStep(step);
          }
        }}
        onUpdateSearchData={(data) => setEditSearchData((previous) => ({ ...previous, ...data }))}
        onCompleteSearch={(data) => router.setParams({
          locationName: data.location?.name || '',
          checkIn: data.dates?.checkIn || '',
          checkOut: data.dates?.checkOut || '',
          adults: String(data.guests?.adults || 1),
          children: String(data.guests?.children || 0),
        })}
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
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
  },
  headerGradient: {
    paddingBottom: 14,
    paddingHorizontal: 21,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideSlot: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryPill: {
    flex: 1,
    minWidth: 0,
    height: 65,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderRadius: 100,
    borderColor: 'rgba(107, 114, 128, 0.1)',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 10,
  },
  summaryLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  summaryContent: {
    ...StyleSheet.absoluteFillObject,
  },
  searchTabsContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  searchTab: {
    flex: 1,
    minWidth: 0,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTabActive: {
    backgroundColor: '#E5E6E8',
  },
  searchTabText: {
    color: '#6B7280',
    fontSize: 14,
  },
  tabDivider: {
    width: 1,
    height: 35,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
  },
  locationTitle: {
    position: 'absolute',
    top: 13,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '400',
    color: '#111827',
  },
  summaryRow: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  summarySubText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#787878',
  },
  summaryDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    rowGap: 24,
  },
  cardWrapper: {
    marginBottom: 8,
  },
});

