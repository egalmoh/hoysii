import { useState, useRef, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { ActivityIndicator } from 'react-native';
import AvailableRoomCard from '../../components/AvailableRoomCard';

export default function ListingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const hotelId = String(Array.isArray(id) ? id[0] : id);
  const params = useLocalSearchParams();
  
  // Read search params from navigation
  const checkIn = typeof params.checkIn === 'string' ? params.checkIn : 'select dates';
  const checkOut = typeof params.checkOut === 'string' ? params.checkOut : '';
  const adults = typeof params.adults === 'string' ? params.adults : '';
  const children = typeof params.children === 'string' ? params.children : '';
  
  const [hotel, setHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setHotel(null);
    setRooms([]);
    const fetchHotelAndRooms = async () => {
      try {
        // Fetch hotel
        const { data: hotelData, error: hotelError } = await api
          .from('hotels')
          .select('*')
          .eq('id', hotelId)
          .single();
        
        if (hotelError) throw hotelError;
        if (active) setHotel(hotelData);

        // Fetch rooms
        const { data: roomsData, error: roomsError } = await api
          .from('rooms')
          .select('*')
          .eq('hotel_id', hotelId)
          .eq('check_in', checkIn && checkIn !== 'select dates' && checkOut ? checkIn : '')
          .eq('check_out', checkIn && checkIn !== 'select dates' && checkOut ? checkOut : '')
          .eq('adults', Number(adults) || 1);
          
        if (roomsError) throw roomsError;
        if (active) setRooms(roomsData || []);
      } catch (error) {
        console.error('Error fetching details:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchHotelAndRooms();
    return () => { active = false; };
  }, [hotelId, checkIn, checkOut, adults]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#489CFC" />
      </View>
    );
  }

  if (!hotel) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Hotel not found</Text>
      </View>
    );
  }

  const IMAGE_HEIGHT = Math.round(width * (451 / 440));



  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const imgIndex = Math.round(scrollPosition / width);
    if (imgIndex !== activeIndex && imgIndex >= 0 && imgIndex < (hotel.images || []).length) {
      setActiveIndex(imgIndex);
    }
  };

  const scrollToIndex = (newIndex) => {
    if (newIndex >= 0 && newIndex < (hotel.images || []).length) {
      scrollRef.current?.scrollTo({ x: newIndex * width, animated: true });
      setActiveIndex(newIndex);
    }
  };

  const goLeft = () => scrollToIndex(activeIndex - 1);
  const goRight = () => scrollToIndex(activeIndex + 1);

  const offers = [
    { id: 'security', label: 'Security Guard', icon: 'account-tie-hat' },
    { id: 'gym', label: 'Gym', icon: 'dumbbell' },
    { id: 'wifi', label: 'Free Wifi', icon: 'wifi' },
    { id: 'restaurant', label: 'Restaurant', icon: 'silverware-fork-knife' },
  ];

  // Transform rooms for the card
  const displayRooms = rooms.map(room => ({
    ...room,
    bedSize: room.bed_size,
    capacityAdults: room.capacity_adults,
    image: room.images?.[0] || room.images?.[1] || room.images?.[2] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600',
    amenities: (room.amenities || []).join(', '),
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View pointerEvents="box-none" style={[styles.navigationHeader, {
        paddingTop: insets.top + 4,
        paddingLeft: insets.left + 16,
        paddingRight: insets.right + 16,
      }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
        >
          <Feather name="arrow-left" size={18} color="#111827" />
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Scrollable hotel images */}
        <View style={[styles.imageWrapper, { width, height: IMAGE_HEIGHT }]}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate={0.92}
          snapToInterval={width}
          snapToAlignment="center"
          onScroll={handleScroll}
          scrollEventThrottle={8}
          bounces
          overScrollMode="always"
          nestedScrollEnabled
          style={{ width, height: IMAGE_HEIGHT }}
          contentContainerStyle={styles.imageScrollContent}
        >
          {(hotel.images || []).map((image, index) => (
            <Image
              key={index}
              source={{ uri: image }}
              style={{ width, height: IMAGE_HEIGHT }}
              resizeMode="cover"
            />
          ))}
        </Animated.ScrollView>

        {/* Left arrow */}
        {activeIndex > 0 && (
          <TouchableOpacity
            onPress={goLeft}
            style={[styles.arrowButton, styles.arrowLeft, { top: IMAGE_HEIGHT / 2 - 12.5 }]}
            activeOpacity={0.8}
          >
            <Feather name="chevron-left" size={16} color="#111827" />
          </TouchableOpacity>
        )}

        {/* Right arrow */}
        {activeIndex < (hotel.images || []).length - 1 && (
          <TouchableOpacity
            onPress={goRight}
            style={[styles.arrowButton, styles.arrowRight, { top: IMAGE_HEIGHT / 2 - 12.5 }]}
            activeOpacity={0.8}
          >
            <Feather name="chevron-right" size={16} color="#111827" />
          </TouchableOpacity>
        )}

        {/* Dots */}
        <View style={styles.dotsContainer}>
          {(hotel.images || []).map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: index === activeIndex ? '#FAFAFA' : 'rgba(250,250,250,0.5)' },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Hotel Details Section */}
      <View style={styles.details}>
        {/* Hotel Name and Location Section */}
        <View style={styles.detailsContent}>
            <View style={styles.nameLocationSection}>
              <Text style={styles.hotelNameWithTagline}>
                {hotel.name}
              </Text>
              
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={18} color="#6B7280" />
                <Text style={styles.addressText}>
                  {hotel.address[0]}
                </Text>
              </View>
            </View>

            {/* Verified Badge Section */}
            <View style={styles.dividerAndVerifiedSection}>
              <View style={styles.verifiedSection}>
                <View style={styles.verifiedBadge}>
                  <MaterialCommunityIcons name="shield-check" size={23} color="#489CFC" />
                  <Text style={styles.verifiedText}>verified by hoysii team</Text>
                </View>
              </View>

              {/* Divider Line */}
              <View style={styles.divider} />
            </View>

            {/* What this hotel offers */}
            <View style={styles.offersSection}>
              <Text style={styles.offersTitle}>What this hotel offers?</Text>

              <View style={styles.offersRow}>
                {offers.map((offer) => (
                  <View key={offer.id} style={styles.offerItem}>
                    <View style={styles.offerIconWrapper}>
                      <MaterialCommunityIcons
                        name={offer.icon}
                        size={20}
                        color="#6B7280"
                      />
                    </View>
                    <Text style={styles.offerLabel}>{offer.label}</Text>
                  </View>
                ))}
              </View>
            </View>

          {/* Availability Section */}
          <View style={styles.availabilitySection}>
            <Text style={styles.availabilityTitle}>Availability</Text>

            <View style={styles.roomsList}>
              {displayRooms.length === 0 && <Text style={styles.emptyRoomsText}>No rooms are available for these dates. Try different dates.</Text>}
              {displayRooms.map((room, index) => (
                <View key={room.id} style={index < rooms.length - 1 ? styles.roomCardWrapper : null}>
                  <AvailableRoomCard room={room} hotel={hotel} searchParams={{ checkIn, checkOut, adults, children }} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
      
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
  imageWrapper: {
    position: 'relative',
    marginBottom: 0,
  },
  imageScrollContent: {
    flexDirection: 'row',
  },
  arrowButton: {
    position: 'absolute',
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: 'rgba(250, 250, 250, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    
  },
  arrowLeft: {
    left: 16,
  },
  arrowRight: {
    right: 16,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 45,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 2,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    minHeight: 36,
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250, 250, 250, 0.92)',
    borderRadius: 21,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  navigationHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'transparent',
    paddingBottom: 8,
  },
  backLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#111827',
  },
  details: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: '#FAFAFA',
    marginTop: -30,
    marginBottom: 30,
    paddingTop: 10,
    width: '100%',
  },
  detailsContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    width: '100%',
  },
  nameLocationSection: {
    width: '100%',
    marginBottom: 40,
  },
  hotelNameWithTagline: {
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 32,
    color: '#111827',
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#6B7280',
    marginLeft: 6,
  },
  verifiedSection: {
    width: '100%',
    alignItems: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#E4E9E8',
    borderRadius: 57,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    lineHeight: 16,
    textTransform: 'uppercase',
    color: '#6B7280',
    marginLeft: 4,
  },
  dividerAndVerifiedSection: {
    width: '100%',
    marginBottom: 24,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    marginTop: 14,
  },
  offersSection: {
    width: '100%',
    marginBottom: 24,
  },
  offersTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 22,
    color: '#111827',
    marginBottom: 16,
  },
  offersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  offerItem: {
    alignItems: 'center',
  },
  offerIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E4E9E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  offerLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  availabilitySection: {
    width: '100%',
  },
  availabilityTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 22,
    color: '#111827',
    marginBottom: 18,
  },
  roomsList: {
    width: '100%',
  },
  emptyRoomsText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
  },
  roomCardWrapper: {
    width: '100%',
    marginBottom: 14,
  },
});
