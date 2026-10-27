import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import HotelCard from '../components/HotelCard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

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
  const checkIn = typeof params.checkIn === 'string' ? params.checkIn : '';
  const checkOut = typeof params.checkOut === 'string' ? params.checkOut : '';
  const adultsParam = typeof params.adults === 'string' ? params.adults : '1';
  const childrenParam = typeof params.children === 'string' ? params.children : '0';

  const adults = parseInt(adultsParam, 10) || 1;
  const children = parseInt(childrenParam, 10) || 0;

  const [loading, setLoading] = useState(true);
  const [hotels, setHotels] = useState([]);

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        let query = supabase.from('hotels').select('*');
        
        if (locationName && locationName.toLowerCase() !== 'any') {
          // Use ilike for case-insensitive partial match on city
          query = query.ilike('city', `%${locationName}%`);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        setHotels(data || []);
      } catch (error) {
        console.error('Error fetching search results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, [locationName]);

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
      <View style={styles.headerWrapper}>
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
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={24} color="#6B7280" />
            </TouchableOpacity>

            <View style={styles.summaryPill}>
              <Text style={styles.locationTitle} numberOfLines={1}>
                {titleLocation}
              </Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summarySubText}>{dateLabel}</Text>
                <View style={styles.summaryDivider} />
                <Text style={styles.summarySubText}>{adultsLabel}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {}}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <Feather name="filter" size={24} color="#6B7280" />
            </TouchableOpacity>
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
             <Text style={{ color: '#6B7280' }}>No hotels found in {locationName}.</Text>
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
    gap: 12,

  },
  iconButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryPill: {
    flex: 1,
    height: 65,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderRadius: 100,
    width: 268,
    borderColor: 'rgba(107, 114, 128, 0.1)',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 10,
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

