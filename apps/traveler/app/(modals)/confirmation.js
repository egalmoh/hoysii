import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import LottieView from 'lottie-react-native';
import { useUser } from '../../lib/auth';
import { apiFetch } from '../../lib/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';

// Import the sound asset
const successSound = require('../../assets/sounds/success.mp3');

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    apiFetch(`/v1/bookings/${encodeURIComponent(params.bookingId || '')}`).then((data) => {
      if (data.payment_status !== 'paid' || data.booking_status !== 'confirmed') throw new Error('This booking does not have a confirmed payment yet. Check Trips or contact Hoysii support.');
      if (active) setBooking(data);
    }).catch((error) => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [params.bookingId]);
  
  // Use the new expo-audio hook
  const player = useAudioPlayer(successSound);

  // Play success sound on mount
  useEffect(() => {
    if (player && booking) {
      player.play();
    }
  }, [player, booking]);

  const hotelName = booking?.hotels?.name || '';
  const hotelLocation = booking?.hotels?.city || 'your destination';
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || 'your email';
  const firstName = user?.firstName || 'Traveler';
  const bookingId = booking?.reference || '';
  const checkIn = booking?.check_in_date || '';
  const checkOut = booking?.check_out_date || '';
  const adults = booking?.adults || 1;
  const children = booking?.children || 0;
  const hotelAddress = Array.isArray(booking?.hotels?.address) ? booking.hotels.address.join(', ') : booking?.hotels?.address || 'Address not available';

  // Format dates for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(`${dateStr}T12:00:00`);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const datesDisplay = checkIn && checkOut ? `${formatDate(checkIn)} - ${formatDate(checkOut)}` : 'N/A';
  const guestsDisplay = `${adults} Adult${adults > 1 ? 's' : ''}${children > 0 ? `, ${children} Child${children > 1 ? 'ren' : ''}` : ''}`;

  if (!booking) return <View style={[styles.container, { paddingTop: insets.top + 40, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }]}><StatusBar style="dark" />{error ? <Text style={styles.subText}>{error}</Text> : <ActivityIndicator color="#489CFC" />}<TouchableOpacity onPress={() => router.replace('/(tabs)/trips')} style={{ padding: 20 }}><Text style={{ color: '#489CFC' }}>Go to trip page</Text></TouchableOpacity></View>;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header with Gradient - extends into content area */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#D6EBFF', '#FFFFFF']}
          locations={[0, 0.4]}
          start={{ x: 0.1, y: -0.3 }}
          end={{ x: 0, y: 1 }}
          style={[styles.headerGradient, { paddingTop: insets.top }]}
        >
          {/* Top Row: Title */}
          <View style={styles.topRow}>
            <View style={{ width: 38 }} />
            <Text style={styles.headerTitle}>Confirmed</Text>
            <View style={{ width: 38 }} />
          </View>
          
          {/* Border line */}
          <View style={styles.headerBorder} />
          
          {/* Check Animation - inside gradient */}
          <View style={styles.animationContainer}>
            <LottieView
              source={require('../../assets/animations/check.json')}
              autoPlay
              loop={false}
              style={styles.animation}
            />
          </View>
        </LinearGradient>
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Confirmation Text */}
        <View style={styles.textContainer}>
          <Text style={styles.mainText}>
            Pack your bags, {firstName.charAt(0).toUpperCase() + firstName.slice(1)}! You're going to {hotelLocation}.
          </Text>
          <Text style={styles.subText}>
            Your booking at <Text style={styles.boldText}>{hotelName}</Text> is confirmed. {booking.receipt_email_status === 'sent' ? 'We have sent your receipt to ' : 'Your receipt is available in Trips. We will also email it to '}<Text style={styles.boldText}>{userEmail}</Text>.
          </Text>
        </View>

        {/* Receipt Section */}
        <View style={styles.receiptSection}>
          <Text style={styles.receiptTitle}>Receipt</Text>
          
          <View style={styles.receiptCard}>
            {/* Booking Id Row */}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Booking Id</Text>
              <Text style={styles.receiptValue}>{bookingId}</Text>
            </View>
            
            {/* Dates Row */}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Dates</Text>
              <Text style={styles.receiptValue}>{datesDisplay}</Text>
            </View>
            
            {/* Guests Row */}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Guests</Text>
              <Text style={styles.receiptValue}>{guestsDisplay}</Text>
            </View>
            
            {/* Address Row */}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Address</Text>
              <Text style={styles.receiptValue}>{hotelAddress}</Text>
            </View>
          </View>
        </View>

        <View style={styles.trustSection}>
          <View style={styles.trustContent}>
            <View style={styles.trustIconWrapper}>
              <MaterialCommunityIcons name="shield-lock" size={28} color="#111827" />
            </View>
            <Text style={styles.trustText}>
              Your funds are held securely by Hoysii. {'\n'}The host is not paid until 24 hours after you successfully check in.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.doneButton}
          activeOpacity={0.8}
          onPress={() => router.replace('/(tabs)/trips')}
        >
          <Text style={styles.doneButtonText}>Go to trip page</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerWrapper: {
    
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
  },
  headerBorder: {
    height: 0.5,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
    marginHorizontal: -20,
  },
  animationContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 16,
  },
  animation: {
    width: 180,
    height: 180,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 34,
    paddingBottom: 16,
  },
  textContainer: {
    alignItems: 'center',
    gap: 17,
    paddingHorizontal: 20,
  },
  mainText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    textAlign: 'center',
  },
  subText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    color: '#111827',
    textAlign: 'center',
  },
  boldText: {
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  receiptSection: {
    marginTop: 46,
    gap: 12,
  },
  receiptTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
  },
  receiptCard: {
    backgroundColor: '#F3F3F3',
    borderWidth: 0.5,
    borderColor: 'rgba(107, 114, 128, 0.25)',
    borderRadius: 10,
    padding: 15,
    gap: 15,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#6B7280',
  },
  receiptValue: {
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
  },
  trustSection: {
    width: '100%',
    backgroundColor: 'rgba(11, 218, 80, 0.12)',
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 14,
    marginTop: 46,
  },
  trustContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  trustIconWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  doneButton: {
    backgroundColor: '#489CFC',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
});
