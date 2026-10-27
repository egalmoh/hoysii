import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DISMISS_THRESHOLD = 60;

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Animation
  const translateY = useSharedValue(600);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 300 });
  }, []);

  const close = () => {
    router.back();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD) {
        translateY.value = withTiming(600, { duration: 200 }, () => {
          runOnJS(close)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleClose = () => {
    translateY.value = withTiming(600, { duration: 200 }, () => {
      runOnJS(close)();
    });
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <Animated.View style={[styles.modalContent, animatedStyle, { paddingBottom: 20 + insets.bottom }]}>
          {/* Drag Handle - only this area is swipe-to-dismiss */}
          <GestureDetector gesture={panGesture}>
            <View style={styles.dragHandleArea}>
              <View style={styles.dragHandle} />
            </View>
          </GestureDetector>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Terms & Policies</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Feather name="x" size={24} color="#6B7280" />
            </Pressable>
          </View>
          
          {/* Scrollable Content */}
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
            >
              {/* Section 1: Trust Guarantee */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>1. HOYSII GUARANTEE</Text>
                <Text style={styles.sectionText}>
                  We protect your payments to ensure a safe booking experience.
                </Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Secure Holding:</Text> Your funds are held securely by Hoysii. The host is not paid until 24 hours after you successfully check in.
                  </Text>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Money Back Promise:</Text> If the hotel turns you away or the room is significantly different from the photos, you will receive 100% of your money back.
                  </Text>
                </View>
              </View>

              {/* Section 2: Booking Policy */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>2. BOOKING POLICY</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Reservations:</Text> A booking is only confirmed once payment is successfully processed.
                  </Text>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Check-in Requirements:</Text> You must present a valid ID and your booking confirmation at the hotel reception.
                  </Text>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Price Changes:</Text> Prices are set by the hotel and are final at the time of booking.
                  </Text>
                </View>
              </View>

              {/* Section 3: Cancellation Policy */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>3. CANCELLATION POLICY</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Free Cancellation:</Text> You may cancel free of charge up to 24 hours before your scheduled check-in time.
                  </Text>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Late Cancellation:</Text> Cancellations made less than 24 hours before check-in will incur a fee equivalent to the first night's stay and Hoysii service fee.
                  </Text>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• No-Shows:</Text> If you do not arrive on the check-in date, half of the booking cost is non-refundable.
                  </Text>
                </View>
              </View>

              {/* Section 4: Refund Process */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>4. REFUND PROCESS</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Processing Time:</Text> Approved refunds are processed within 5-7 business days.
                  </Text>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Method:</Text> Refunds are strictly returned to the original payment method (e.g., Waafi, EVC Plus, or Credit Card). Cash refunds are not available.
                  </Text>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Disputes:</Text> To claim a refund under the "Money Back Promise," you must contact support within 24 hours of your scheduled check-in.
                  </Text>
                </View>
              </View>

              {/* Section 5: Privacy Statement */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>5. PRIVACY STATEMENT</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Data Collection:</Text> We strictly collect only what is needed: Name, Phone Number, and Booking Details.
                  </Text>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• Sharing:</Text> Your details are shared only with the specific hotel you book to secure your room.
                  </Text>
                  <Text style={styles.bulletItem}>
                    <Text style={styles.bold}>• No Spam:</Text> We do not sell your data to third parties.
                  </Text>
                </View>
              </View>

              {/* Section 6: Contact */}
              <View style={[styles.section, styles.lastSection]}>
                <Text style={styles.sectionTitle}>6. CONTACT</Text>
                <Text style={styles.sectionText}>
                  For disputes and other questions: call us on WhatsApp by clicking the support button on the profile.
                </Text>
              </View>
            </ScrollView>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    minHeight: '70%',
    maxHeight: '85%',
  },
  dragHandleArea: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandle: {
    width: 48,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    fontFamily: 'Inter_700Bold',
  },
  closeButton: {
    padding: 8,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter_400Regular',
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    fontFamily: 'Inter_400Regular',
  },
  bulletList: {
    gap: 12,
  },
  bulletItem: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4B5563',
    fontFamily: 'Inter_400Regular',
    paddingLeft: 4,
  },
  bold: {
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#111827',
  },
});
