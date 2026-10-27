import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import WhatsAppModal from '../../components/WhatsAppModal';
import { supabase, createSupabaseClient } from '../../lib/supabase';
import { StatusBar } from 'expo-status-bar';

const WHATSAPP_STORAGE_KEY = '@user_whatsapp_number';

// Payment Methods Data (must match payment.js)
const PAYMENT_METHODS = [
  {
    id: 'premier_wallet',
    name: 'Premiere Bank',
    type: 'bank',
    image: require('../../assets/Images/premier_bank.png'),
  },
  {
    id: 'waafi',
    name: 'Waafi',
    type: 'wallet',
    image: require('../../assets/Images/waafi.png'),
  }
];

// ----------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------
// Utilities for formatting dates, calculating prices, and formatting strings.
// ----------------------------------------------------------------------

function formatDateRange(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 'Select dates';
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  try {
    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return 'Select dates';
    
    const inMonth = monthNames[inDate.getMonth()];
    const inDay = inDate.getDate();
    const outMonth = monthNames[outDate.getMonth()];
    const outDay = outDate.getDate();
    const year = outDate.getFullYear();
    
    if (inMonth === outMonth) {
      return `${inMonth} ${inDay} - ${outDay}, ${year}`;
    } else {
      return `${inMonth} ${inDay} - ${outMonth} ${outDay}, ${year}`;
    }
  } catch {
    return 'Select dates';
  }
}

function formatGuests(adults, children) {
  const totalAdults = parseInt(adults) || 1;
  const totalChildren = parseInt(children) || 0;
  
  if (totalChildren === 0) {
    return `${totalAdults} Adult${totalAdults > 1 ? 's' : ''}`;
  } else {
    return `${totalAdults} Adult${totalAdults > 1 ? 's' : ''}, ${totalChildren} Child${totalChildren > 1 ? 'ren' : ''}`;
  }
}

function calculateTotalPrice(roomPrice, checkIn, checkOut) {
  if (!checkIn || !checkOut || !roomPrice) return 0;
  
  try {
    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return 0;
    
    const nights = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
    const price = parseInt(roomPrice) || 0;
    const basePrice = nights * price;
    const serviceFee = Math.round(basePrice * 0.1);
    
    return basePrice + serviceFee;
  } catch {
    return 0;
  }
}

function calculatePriceBreakdown(roomPrice, checkIn, checkOut) {
  if (!checkIn || !checkOut || !roomPrice) {
    return {
      nightlyRate: parseInt(roomPrice) || 0,
      nights: 7,
      basePrice: 0,
      serviceFee: 0,
      total: 0,
    };
  }
  
  try {
    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
      return {
        nightlyRate: parseInt(roomPrice) || 0,
        nights: 7,
        basePrice: 0,
        serviceFee: 0,
        total: 0,
      };
    }
    
    const nights = Math.ceil((outDate - inDate) / (1000 * 60 * 60 * 24));
    const nightlyRate = parseInt(roomPrice) || 0;
    const basePrice = nights * nightlyRate;
    const serviceFee = Math.round(basePrice * 0.1);
    const total = basePrice + serviceFee;
    
    return {
      nightlyRate,
      nights,
      basePrice,
      serviceFee,
      total,
    };
  } catch {
    return {
      nightlyRate: parseInt(roomPrice) || 0,
      nights: 7,
      basePrice: 0,
      serviceFee: 0,
      total: 0,
    };
  }
}

function formatCancellationDeadline(checkIn) {
  if (!checkIn) return 'Jan 8, 2:00 PM';
  
  try {
    const checkInDate = new Date(checkIn);
    if (isNaN(checkInDate.getTime())) return 'Jan 8, 2:00 PM';
    
    // Cancellation deadline is 24 hours before check-in (2:00 PM the day before)
    const deadline = new Date(checkInDate);
    deadline.setDate(deadline.getDate() - 1);
    deadline.setHours(14, 0, 0, 0); // 2:00 PM
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[deadline.getMonth()];
    const day = deadline.getDate();
    const hours = deadline.getHours();
    const minutes = deadline.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    
    return `${month} ${day}, ${displayHours}:${displayMinutes} ${ampm}`;
  } catch {
    return 'Jan 8, 2:00 PM';
  }
}

// ----------------------------------------------------------------------
// COMPONENT: BookingReview
// ----------------------------------------------------------------------
// Main screen for reviewing booking details before payment.
// Handles:
// - Date and Guest selection/editing via modals
// - Price calculation based on stay duration
// - User authentication check & WhatsApp number collection
// - Review of hotel details
// ----------------------------------------------------------------------
export default function BookingReview() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isSignedIn, userId, getToken } = useAuth();

  // Get dynamic data from route params
  const hotelId = params.hotelId;
  const roomId = params.roomId;
  const hotelName = params.hotelName;
  const roomType = params.roomName || 'Superior Deluxe Room (VIP)';
  const hotelImageUri = params.hotelImage;
  const roomImageUri = params.roomImage;
  const hotelAddress = params.location || params.address || 'Address not available';


  
  // ----------------------------------------------------------------------
  // STATE & PARAMS
  // ----------------------------------------------------------------------
  
  // Get booking details from params
  const [checkIn, setCheckIn] = useState(params.checkIn || '');
  const [checkOut, setCheckOut] = useState(params.checkOut || '');
  const [adults, setAdults] = useState(parseInt(params.adults) || 1);
  const [children, setChildren] = useState(parseInt(params.children) || 0);
  const roomPrice = params.roomPrice || '90';
  
  // Modal states
  const [datesModalVisible, setDatesModalVisible] = useState(false);
  const [guestsModalVisible, setGuestsModalVisible] = useState(false);
  const [selectedDates, setSelectedDates] = useState({ checkIn: checkIn, checkOut: checkOut });
  const [markedDates, setMarkedDates] = useState({});
  const [priceTooltipVisible, setPriceTooltipVisible] = useState(false);
  const [whatsappModalVisible, setWhatsappModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);

  // Check for payment method from params or AsyncStorage
  // Using useFocusEffect to re-check when returning from payment screen
  useFocusEffect(
    useCallback(() => {
      const checkPaymentMethod = async () => {
        // First check params (for backwards compatibility)
        if (params.paymentMethod) {
          setPaymentMethod({
            id: params.paymentMethod,
            name: params.paymentMethodName || 'Mobile Money'
          });
          return;
        }
        
        // Then check AsyncStorage (set by payment screen)
        try {
          const storedPayment = await AsyncStorage.getItem('selectedPaymentMethod');
          if (storedPayment) {
            const parsed = JSON.parse(storedPayment);
            setPaymentMethod(parsed);
            // Clear it after reading
            await AsyncStorage.removeItem('selectedPaymentMethod');
          }
        } catch (error) {

        }
      };
      
      checkPaymentMethod();
    }, [params.paymentMethod])
  );


  
  // Initialize marked dates from params
  useEffect(() => {
    if (checkIn && checkOut) {
      const range = getDateRange(checkIn, checkOut);
      const newMarkedDates = {};
      range.forEach((date, index) => {
        const isStart = index === 0;
        const isEnd = index === range.length - 1;
        newMarkedDates[date] = {
          startingDay: isStart,
          endingDay: isEnd,
          color: (isStart || isEnd) ? '#489CFC' : '#C5E0FE',
          textColor: (isStart || isEnd) ? '#FFFFFF' : '#111827',
        };
      });
      setMarkedDates(newMarkedDates);
      setSelectedDates({ checkIn, checkOut });
    }
  }, []);


  // Track if we've already triggered the WhatsApp check after login
  const [hasCheckedWhatsApp, setHasCheckedWhatsApp] = useState(false);

  // Auto-check for WhatsApp number after login redirect
  useEffect(() => {
    const checkWhatsAppAfterLogin = async () => {
      // Only trigger if:
      // 1. We have the showWhatsAppCheck flag from login redirect
      // 2. User is now signed in
      // 3. We haven't already checked (to prevent duplicates)
      if (params.showWhatsAppCheck === 'true' && isSignedIn && !hasCheckedWhatsApp) {
        setHasCheckedWhatsApp(true); // Mark as checked
        try {
          // Check Supabase with authenticated client
          if (!userId) return;

          const token = await getToken({ template: 'supabase' });
          const authenticatedSupabase = createSupabaseClient(token);

          const { data: userData, error: userError } = await authenticatedSupabase
            .from('users')
            .select('phone_number')
            .eq('clerk_id', userId)
            .maybeSingle();

          if (userError) {
            console.error('Error checking phone number:', userError);
          }

          const storedNumber = userData?.phone_number;

          // Only show modal if no phone number exists in database
          if (!storedNumber) {
            // Small delay to ensure the modal is ready to be displayed
            setTimeout(() => {
              setWhatsappModalVisible(true);
            }, 500);
          }
        } catch (error) {
          console.error('Error checking WhatsApp number after login:', error);
        }
      }
    };

    checkWhatsAppAfterLogin();
  }, [params.showWhatsAppCheck, isSignedIn, hasCheckedWhatsApp, userId]);

  // Calculate cancellation deadline (24 hours before check-in)
  const getCancellationDeadline = () => {
    if (!checkIn) return '';
    
    try {
      const checkInDate = new Date(checkIn);
      if (isNaN(checkInDate)) return 'no dates selected';
      // Subtract 24 hours (1 day)
      checkInDate.setDate(checkInDate.getDate() - 1);
      
      // Format as "Feb 3, 2026"
      return checkInDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return '';
    }
  };

  const cancellationDeadline = getCancellationDeadline();
  
  // Get all dates between start and end
  const getDateRange = (startDate, endDate) => {
    const dates = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };
  
  // ----------------------------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------------------------

  // Handle date selection in the calendar
  const handleDayPress = (day) => {
    const dateString = day.dateString;
    
    if (!selectedDates.checkIn || (selectedDates.checkIn && selectedDates.checkOut)) {
      // Start new selection
      setSelectedDates({ checkIn: dateString, checkOut: null });
      setMarkedDates({
        [dateString]: {
          startingDay: true,
          endingDay: true,
          color: '#489CFC',
          textColor: '#FFFFFF',
        },
      });
    } else if (dateString > selectedDates.checkIn) {
      // Set checkout date and mark range
      const newDates = { ...selectedDates, checkOut: dateString };
      setSelectedDates(newDates);
      
      const range = getDateRange(selectedDates.checkIn, dateString);
      const newMarkedDates = {};
      
      range.forEach((date, index) => {
        const isStart = index === 0;
        const isEnd = index === range.length - 1;
        newMarkedDates[date] = {
          startingDay: isStart,
          endingDay: isEnd,
          color: (isStart || isEnd) ? '#489CFC' : '#C5E0FE',
          textColor: (isStart || isEnd) ? '#FFFFFF' : '#111827',
        };
      });
      
      setMarkedDates(newMarkedDates);
    } else {
      // If selected date is before check-in, restart selection
      setSelectedDates({ checkIn: dateString, checkOut: null });
      setMarkedDates({
        [dateString]: {
          startingDay: true,
          endingDay: true,
          color: '#489CFC',
          textColor: '#FFFFFF',
        },
      });
    }
  };
  
  // Update dates
  const handleDatesSave = () => {
    if (selectedDates.checkIn && selectedDates.checkOut) {
      setCheckIn(selectedDates.checkIn);
      setCheckOut(selectedDates.checkOut);
      
      // Update route params
      router.setParams({
        ...params,
        checkIn: selectedDates.checkIn,
        checkOut: selectedDates.checkOut,
      });
      
      setDatesModalVisible(false);
    }
  };
  
  // Update guests
  const handleGuestsSave = () => {
    router.setParams({
      ...params,
      adults: String(adults),
      children: String(children),
    });
    
    setGuestsModalVisible(false);
  };
  
  const dateRange = formatDateRange(checkIn, checkOut) || 'Select dates';
  const guestsText = formatGuests(String(adults), String(children));
  const totalPrice = calculateTotalPrice(roomPrice, checkIn, checkOut);
  const priceBreakdown = calculatePriceBreakdown(roomPrice, checkIn, checkOut);


  // ----------------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------------
  
  return (
    <View style={styles.container}>
            <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={['#D6EBFF', '#FAFAFA']}
          locations={[0, 0.4]}

          start={{ x: 0.1, y: -0.3 }}
          end={{ x: 0, y: 1 }}
          style={[styles.headerGradient, { paddingTop: insets.top + 12 }]}
        >
          {/* Top Row: Back + Title */}
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={() => {
                // After router.replace from login, navigation stack is reset
                // Use router.replace to go to a safe destination
                try {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    // Fallback: navigate to home tabs since there's no history
                    router.replace('/(tabs)');
                  }
                } catch (e) {
                  // Ultimate fallback
                  console.error('Navigation error:', e);
                  router.replace('/(tabs)');
                }
              }}
              style={styles.iconButton}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={24} color="#6B7280" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Review</Text>

            {/* spacer to balance layout */}
            <View style={styles.iconButton} />
          </View>
          <View style={styles.divider} />

          {/* Hotel Summary Card */}
          <View style={styles.hotelRow}>
            <Image
              source={{ uri: roomImageUri }}
              style={styles.hotelImage}
              resizeMode="cover"
            />

            <View style={styles.hotelInfo}>
              <View style={styles.textBlock}>
                <Text style={styles.hotelName} numberOfLines={2}>
                  {hotelName}
                </Text>
                <Text style={styles.roomType} numberOfLines={1}>
                  {roomType}
                </Text>
              </View>

              <View style={styles.verifiedPill}>
                <MaterialCommunityIcons
                  name="shield-check"
                  size={16}
                  color="#489CFC"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.verifiedText} numberOfLines={1}>
                  VERIFIED BY HOYSII TEAM
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Booking Details Section */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.bookingDetailsContainer}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bookingDetailsSection}>
          {/* Dates Row */}
          <View style={styles.detailRow}>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Dates</Text>
              <Text style={styles.detailValue}>{dateRange}</Text>
            </View>
            <TouchableOpacity 
              style={styles.editButton} 
              activeOpacity={0.7}
              onPress={() => setDatesModalVisible(true)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Guests Row */}
          <View style={styles.detailRow}>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Guests</Text>
              <Text style={styles.detailValue}>{guestsText}</Text>
            </View>
            <TouchableOpacity 
              style={styles.editButton} 
              activeOpacity={0.7}
              onPress={() => setGuestsModalVisible(true)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Total Price Row */}
          <View style={styles.totalPriceRow}>
            <Text style={styles.detailLabel}>Total Price</Text>
            <TouchableOpacity
                onPress={() => {
                  setPriceTooltipVisible(!priceTooltipVisible);
                }}
                activeOpacity={0.7}
                style={styles.totalPriceTouchable}
              >
            <View style={styles.totalPriceValueContainer}>
                <Text style={styles.totalPriceValue}>${totalPrice}</Text>
            </View>
            </TouchableOpacity>
          </View>
          <View style={styles.dividerLast} />

          {/* Cancellation Policy Section */}
          <View style={styles.cancellationPolicySection}>
            <Text style={styles.cancellationPolicyTitle}>Cancellation Policy</Text>
            <Text style={styles.cancellationPolicyText}>
              Free Cancellation until: <Text style={{textDecorationLine: 'underline', color: '#111827'}}>{cancellationDeadline}</Text>.
            </Text>
            <Text style={styles.cancellationPolicyText}>
              After <Text style={{textDecorationLine: 'underline', color: '#111827'}}>{cancellationDeadline}</Text>: Refund minus first night.
            </Text>
          </View>

          {/* Payment Method Section (Visible only when selected) */}
          {paymentMethod && (
            <View style={styles.paymentMethodSection}>
              <Text style={styles.paymentMethodLabel}>Payment Method</Text>
              
              <TouchableOpacity 
                 style={styles.paymentMethodCard}
                 onPress={() => router.push('/(modals)/payment')}
                 activeOpacity={0.8}
              >
                <View style={styles.paymentMethodContent}>
                  <View style={styles.paymentMethodIconWrapper}>
                    <Image 
                        source={PAYMENT_METHODS.find(m => m.id === paymentMethod.id)?.image || require('../../assets/Images/waafi.png')} 
                        style={styles.paymentMethodLogo}
                        resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.paymentMethodName}>{paymentMethod.name}</Text>
                </View>
                
                {/* Edit button on the right */}
                {/* <View style={styles.editButton}>
                  <Text style={styles.editButtonText}>Edit</Text>
                </View> */}
              </TouchableOpacity>
              
              {/* Trust Text Section */}
              <View style={styles.trustSection}>
                <View style={styles.trustContent}>
                  <View style={styles.trustIconWrapper}>
                    <MaterialCommunityIcons name="shield-lock" size={28} color="#111827" />
                  </View>
                  <Text style={styles.trustText}>
                    We hold your payment securely until you successfully check in at the hotel.{'\n\n'}If the hotel turns you away or is significantly different from the photos, you get 100% of your money back.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Price Tooltip */}
      {priceTooltipVisible && (
        <PriceBreakdownTooltip
          breakdown={priceBreakdown}
          onClose={() => setPriceTooltipVisible(false)}
        />
      )}

      {/* Dates Modal */}
      <DatesModal
        visible={datesModalVisible}
        selectedDates={selectedDates}
        markedDates={markedDates}
        onDayPress={handleDayPress}
        onSave={handleDatesSave}
        onClose={() => setDatesModalVisible(false)}
      />

      {/* Guests Modal */}
      <GuestsModal
        visible={guestsModalVisible}
        adults={adults}
        children={children}
        onAdultsChange={setAdults}
        onChildrenChange={setChildren}
        onSave={handleGuestsSave}
        onClose={() => setGuestsModalVisible(false)}
      />

      {/* WhatsApp Number Modal */}
      <WhatsAppModal
        visible={whatsappModalVisible}
        onClose={() => setWhatsappModalVisible(false)}
        onSuccess={() => {
          setWhatsappModalVisible(false);
          // After saving WhatsApp, proceed to payment

        }}
      />

      {/* Next Button Section */}
      <View style={[styles.buttonSection, { paddingBottom: 10 + insets.bottom }]}>

        {/* Next Button */}
        <TouchableOpacity 
          style={styles.nextButton}
          activeOpacity={0.8}
          onPress={async () => {
            // STEP A: Authentication Check
            if (!isSignedIn) {
              // Redirect to login, then come back to booking after auth
              // Use router.push (not replace) so booking screen stays visible behind the modal
              router.push({
                pathname: '/(modals)/login',
                params: {
                  redirectTo: '/(modals)/booking',
                  // Pass current booking params to restore after login
                  hotelName: params.hotelName,
                  roomName: params.roomName,
                  hotelImage: params.hotelImage,
                  roomImage: params.roomImage,
                  roomId: params.roomId,
                  hotelId: params.hotelId,
                  checkIn,
                  checkOut,
                  adults: String(adults),
                  children: String(children),
                  roomPrice,
                  location: params.location,
                  address: params.address,
                },
              });
              return;
            }
            
            // STEP B: WhatsApp Check

            try {
              if (!userId) {
                // Should be caught by Step A, but safety first
                return; 
              }

              // Get auth token and create authenticated client
              const token = await getToken({ template: 'supabase' });
              const authenticatedSupabase = createSupabaseClient(token);

              // Check Supabase users table with authenticated client
              const { data: userData, error: userError } = await authenticatedSupabase
                .from('users')
                .select('phone_number')
                .eq('clerk_id', userId)
                .maybeSingle();

              if (userError) {
                console.error('Error checking user data:', userError);
              }
              
              // If no user data found, we treat it as no phone number
              const dbPhoneNumber = userData?.phone_number;

              if (!dbPhoneNumber) {
                // Show WhatsApp modal
                setWhatsappModalVisible(true);
                return;
              }
            } catch (error) {
              // Fallback: show modal if check fails?
              setWhatsappModalVisible(true);
              return;
            }

            // STEP C: Payment Selection
            if (!paymentMethod) {
              router.push('/(modals)/payment');
              return;
            }
            
            // STEP C.5: Date Validation
            if (!checkIn || !checkOut) {
              alert('Please select check-in and check-out dates.');
              return;
            }
            
            // STEP D: Finalize Booking
            setSubmitting(true);
            try {
              if (!userId || !hotelId || !roomId) {
                alert('Booking information missing. Please try again.');
                setSubmitting(false);
                return;
              }

              // Get Supabase User ID from Clerk ID using authenticated client
              // Note: We can reuse the token/client from above if we hoist the variable, 
              // but for safety/simplicity in this scope we'll get it again if needed or use the one we have.
              // Ideally we'd reuse `authenticatedSupabase` but it's inside a try/catch block scope above? 
              // Actually, the previous block was inside a try/catch for "STEP B". This is "STEP D".
              // Let's get a fresh token/client to be safe and consistent.
              
              const token = await getToken({ template: 'supabase' });
              const authenticatedSupabase = createSupabaseClient(token);

              const { data: userData, error: userError } = await authenticatedSupabase
                .from('users')
                .select('id')
                .eq('clerk_id', userId)
                .maybeSingle();

              if (userError || !userData) {
                alert('Could not verify user account. Please try logging in again.');
                setSubmitting(false);
                return;
              }

              const supabaseUserId = userData.id;

              const { data, error } = await authenticatedSupabase
                .from('bookings')
                .insert([
                  {
                    user_id: supabaseUserId,
                    hotel_id: hotelId,
                    room_id: roomId,
                    check_in_date: checkIn,
                    check_out_date: checkOut,
                    total_price: totalPrice,
                    payment_status: 'pending', // Manual payment for now
                    payment_provider: paymentMethod.id
                  }
                ])
                .select();

              if (error) throw error;
              
              // Navigate to confirmation screen
              router.replace({
                pathname: '/(modals)/confirmation',
                params: {
                  hotelName: hotelName,
                  hotelLocation: hotelName,
                  bookingId: data?.[0]?.id ? `#BKY-${data[0].id.toString().slice(-4)}` : '#BKY-0000',
                  checkIn: checkIn,
                  checkOut: checkOut,
                  adults: adults,
                  children: children,
                  hotelAddress: hotelAddress || 'Address not available',
                }
              });
              
            } catch (error) {
              console.error('Error creating booking:', error);
              alert('Failed to book. Please try again.');
            } finally {
              setSubmitting(false);
            }
          }}
          disabled={submitting}
        > 
          {paymentMethod && <MaterialCommunityIcons name="lock" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />}
          <Text style={styles.nextButtonText}>
            {submitting ? 'Booking...' : (paymentMethod ? 'Pay Securely' : 'Next')}
          </Text>
        </TouchableOpacity>
        
        {/* SSL Encrypted text */}
        {paymentMethod && (
          <View style={styles.sslTextContainer}>
            <Text style={styles.sslText}>
              By clicking the button, you agree to our{' '}
              <Text 
                style={{color: '#6B7280', fontWeight: 'bold', textDecorationLine: 'underline'}}
                onPress={() => router.push('/(modals)/terms')}
              >
                Terms and Conditions
              </Text>
            </Text>
          </View>
        )}
        {/* Line connecting step 1 to step 2 */}
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------
// SUB-COMPONENTS
// ----------------------------------------------------------------------

// Dates Modal Component: Displays a calendar for selecting check-in/out dates
function DatesModal({ visible, selectedDates, markedDates, onDayPress, onSave, onClose }) {
  const translateY = useSharedValue(-50);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    }
  }, [visible]);

  const handleClose = () => {
    opacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(-20, { duration: 200 }, () => {
      runOnJS(onClose)();
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.6,
  }));

  if (!visible) return null;

  return (
    <View style={modalStyles.container} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[modalStyles.backdrop, backdropStyle]}
        pointerEvents="auto"
      >
        <Pressable style={modalStyles.backdropPressable} onPress={handleClose} />
      </Animated.View>

      {/* Modal Content */}
      <Animated.View style={[modalStyles.modal, animatedStyle]} pointerEvents="auto">
        <View style={modalStyles.modalInner}>
          <View style={modalStyles.modalContent}>
            <Text style={modalStyles.title}>When do you want to visit?</Text>

            <View style={modalStyles.calendarContainer}>
              <Calendar
                onDayPress={onDayPress}
                markingType="period"
                markedDates={markedDates}
                minDate={new Date().toISOString().split('T')[0]}
                theme={{
                  backgroundColor: 'transparent',
                  calendarBackground: 'transparent',
                  textSectionTitleColor: '#6B7280',
                  selectedDayBackgroundColor: '#489CFC',
                  selectedDayTextColor: '#FFFFFF',
                  todayTextColor: '#489CFC',
                  dayTextColor: '#111827',
                  textDisabledColor: '#D1D5DB',
                  arrowColor: '#6B7280',
                  monthTextColor: '#6B7280',
                  textDayFontSize: 12,
                  textMonthFontSize: 16,
                  textDayHeaderFontSize: 14,
                }}
                renderArrow={(direction) => (
                  <View style={modalStyles.calendarArrow}>
                    <Feather
                      name={direction === 'left' ? 'chevron-left' : 'chevron-right'}
                      size={18}
                      color="#6B7280"
                    />
                  </View>
                )}
              />
            </View>

            {/* Action Buttons */}
            <View style={modalStyles.actionButtons}>
              <TouchableOpacity onPress={handleClose} style={modalStyles.cancelButton}>
                <Text style={modalStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={onSave} 
                style={[
                  modalStyles.saveButton,
                  (!selectedDates.checkIn || !selectedDates.checkOut) && modalStyles.saveButtonDisabled
                ]}
                disabled={!selectedDates.checkIn || !selectedDates.checkOut}
              >
                <Text style={modalStyles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// Guests Modal Component: Allows user to increment/decrement adult and child counts
function GuestsModal({ visible, adults, children, onAdultsChange, onChildrenChange, onSave, onClose }) {
  const translateY = useSharedValue(-50);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    }
  }, [visible]);

  const handleClose = () => {
    opacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(-20, { duration: 200 }, () => {
      runOnJS(onClose)();
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.6,
  }));

  if (!visible) return null;

  return (
    <View style={modalStyles.container} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[modalStyles.backdrop, backdropStyle]}
        pointerEvents="auto"
      >
        <Pressable style={modalStyles.backdropPressable} onPress={handleClose} />
      </Animated.View>

      {/* Modal Content */}
      <Animated.View style={[modalStyles.modal, animatedStyle]} pointerEvents="auto">
        <View style={[modalStyles.modalInner, { paddingHorizontal: 24 }]}>
          <View style={[modalStyles.modalContent, { gap: 40 }]}>
            <Text style={modalStyles.title}>Who is with you?</Text>

            <View style={{ gap: 24 }}>
              {/* Adults Row */}
              <View>
                <View style={modalStyles.counterRow}>
                  <Text style={modalStyles.counterLabel}>Adults</Text>
                  
                  <View style={modalStyles.counterControls}>
                    <TouchableOpacity
                      onPress={() => onAdultsChange(Math.max(1, adults - 1))}
                      style={modalStyles.counterButton}
                    >
                      <Feather name="minus" size={16} color="#6B7280" />
                    </TouchableOpacity>
                    
                    <Text style={modalStyles.counterValue}>{adults}</Text>
                    
                    <TouchableOpacity
                      onPress={() => onAdultsChange(adults + 1)}
                      style={modalStyles.counterButton}
                    >
                      <Feather name="plus" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={modalStyles.divider} />
              </View>

              {/* Children Row */}
              <View>
                <View style={modalStyles.counterRow}>
                  <Text style={modalStyles.counterLabel}>Children</Text>
                  
                  <View style={modalStyles.counterControls}>
                    <TouchableOpacity
                      onPress={() => onChildrenChange(Math.max(0, children - 1))}
                      style={modalStyles.counterButton}
                    >
                      <Feather name="minus" size={16} color="#6B7280" />
                    </TouchableOpacity>
                    
                    <Text style={modalStyles.counterValue}>{children}</Text>
                    
                    <TouchableOpacity
                      onPress={() => onChildrenChange(children + 1)}
                      style={modalStyles.counterButton}
                    >
                      <Feather name="plus" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={modalStyles.actionButtons}>
              <TouchableOpacity onPress={handleClose} style={modalStyles.cancelButton}>
                <Text style={modalStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onSave} style={modalStyles.saveButton}>
                <Text style={modalStyles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 10,
    zIndex: 10,
  },
  headerGradient: {
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#6B728010',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 25,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 24,
    color: '#111827',
    fontFamily: 'Inter_700Bold',
    
  },
  hotelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  hotelImage: {
    width: 135,
    height: 119,
    borderRadius: 20,
  },
  hotelInfo: {
    flex: 1,
    height: 119,
    justifyContent: 'space-between',
  },
  textBlock: {
    width: '100%',
    gap: 5,
  },
  hotelName: {
    fontSize: 18,
    lineHeight: 22,
    color: '#111827',
    fontFamily: 'Inter_700Bold',
  },
  roomType: {
    fontSize: 14,
    lineHeight: 17,
    color: '#6B7280',
    fontFamily: 'Inter_300Light',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#E4E9E8',
    borderRadius: 16.5,
    alignSelf: 'flex-start',
  },
  verifiedText: {
    fontSize: 10,
    lineHeight: 12,
    color: '#6B7280',
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  divider: {
    width: 500,
    height: 0.5,
    backgroundColor: '#6B728075',
    alignSelf: 'center',
    marginBottom: 10,
  },
  bookingDetailsContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 25,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  bookingDetailsSection: {
    width: '100%',
    gap: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: 39,
  },
  detailInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 5,
    width: 109,
    height: 39,
  },
  providerLogo: {
    width: 90,
    height: 90,
  },
  providerLogoSingle: {
    width: 35,
    height: 35,
  },
  methodName: {
    fontSize: 14,
    lineHeight: 17,
    color: '#111827',
    fontFamily: 'Inter_500Medium',
    fontWeight: '600',
  },
  detailLabel: {
    fontSize: 14,
    lineHeight: 17,
    color: '#111827',
    fontFamily: 'Inter_500Medium',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 12,
    lineHeight: 14,
    color: '#111827',
    fontFamily: 'Inter_300Light',
    fontWeight: '300',
    width: 250,
  },
  editButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 13,
    width: 75,
    height: 25,
    backgroundColor: '#E4E9E8',
    borderRadius: 5,
  },
  editButtonText: {
    fontSize: 12,
    lineHeight: 14,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
  },
  totalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: 17,
  },
  totalPriceValueContainer: {
    flexDirection: 'column',
    height: 30,
    justifyContent: 'center',
  },
  totalPriceValue: {
    fontSize: 14,
    lineHeight: 17,
    color: '#111827',
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  dividerLast: {
    width: '100%',
    height: 1,
    backgroundColor: '#6B728025',
  },
  cancellationPolicySection: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 5,
  },
  cancellationPolicyTitle: {
    width: '100%',
    fontSize: 16,
    lineHeight: 16,
    color: '#111827',
    fontFamily: 'Inter_500Medium',
    fontWeight: '600',
    marginBottom: 5,
  },
  cancellationPolicyText: {
    width: '100%',
    height: 18,
    fontSize: 12,
    lineHeight: 14,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
  // Payment Method Section Styles (matching payment.js design)
  paymentMethodSection: {
    width: '100%',
    marginTop: 16,
    gap: 10,
  },
  paymentMethodLabel: {
    fontSize: 16,
    lineHeight: 17,
    color: '#111827',
    fontFamily: 'Inter_500Medium',
    fontWeight: '600',
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(107, 114, 128, 0.5)',
    borderRadius: 15,
    height: 70,
    paddingRight: 16,
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  paymentMethodIconWrapper: {
    width: 90,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodLogo: {
    width: 80,
    height: 80,
  },
  paymentMethodName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
  },
  // Trust Section Styles
  trustSection: {
    width: '100%',
    backgroundColor: 'rgba(11, 218, 80, 0.12)',
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 14,
    marginTop: 20,
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
  buttonSection: {
    minHeight: 95,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    gap: 5,
    borderTopWidth: 0.5,
    borderTopColor: '#E4E9E8',
    paddingHorizontal: 26,
  },
  nextButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: '#489CFC',
    borderRadius: 10,
    gap: 2,
    width: '100%',
  },
  nextButtonText: {
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
    fontWeight: '600',
    textAlign: 'center',
  },
  sslTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 5,
  },
  sslText: {
    fontSize: 12,
    color: '#6B728095',
    fontFamily: 'Inter_400Regular',
  },
});

// Price Breakdown Tooltip Component: Shows detailed price calculation (taxes, fees)
function PriceBreakdownTooltip({ breakdown, onClose }) {
  return (
    <View style={tooltipStyles.wrapper}>
      {/* Backdrop to close on outside click */}
      <Pressable 
        style={tooltipStyles.backdrop} 
        onPress={onClose}
      />
      <View style={tooltipStyles.container}>
        <View style={tooltipStyles.tooltip}>
          <View style={tooltipStyles.content}>
            <View style={tooltipStyles.textContainer}>
              <Text style={tooltipStyles.text}>Service fee: 10%</Text>
              <Text style={tooltipStyles.text}>Nightly rate: ${breakdown.nightlyRate}</Text>
            </View>
          </View>
          {/* Arrow pointing left */}
        </View>
      </View>
    </View>
  );
}

const tooltipStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    pointerEvents: 'box-none',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 998,
  },
  container: {
    position: 'absolute',
    right: 65,
    top: 380,
    zIndex: 1000,
    elevation: 10,
    pointerEvents: 'box-none',
  },
  tooltip: {
    position: 'relative',
  },
  content: {
    width: 140,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: '#6B7280',
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 19,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 15.6,
    elevation: 5,
    justifyContent: 'center',
  },
  textContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 5,
  },
  text: {
    fontSize: 12,
    lineHeight: 15,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
    width: '100%',
  },
});

const modalStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#00000075',
  },
  backdropPressable: {
    flex: 1,
  },
  modal: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 5,
    marginVertical: 200,
    zIndex: 1001,
  },
  modalInner: {
    padding: 15,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    gap: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter_500Medium',
    marginBottom: 16,
  },
  calendarContainer: {
    borderRadius: 10,
    margin: 0,
    padding: 0,
  },
  calendarArrow: {
    width: 28,
    height: 28,
    backgroundColor: '#E4E9E8',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 0,
    padding: 0,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter_500Medium',
  },
  saveButton: {
    backgroundColor: '#489CFC',
    paddingVertical: 12,
    paddingHorizontal: 39,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter_500Medium',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter_500Medium',
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counterButton: {
    width: 24,
    height: 24,
    backgroundColor: '#E4E9E8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter_500Medium',
    minWidth: 30,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E4E9E8',
  },
});
