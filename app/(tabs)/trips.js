import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { createSupabaseClient } from '../../lib/supabase';

const SUPPORT_WHATSAPP_NUMBER = '+252907275534';

function localDate(value) {
  if (!value) return null;
  const raw = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayDate(value) {
  const date = localDate(value);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable';
}

function nightsBetween(checkIn, checkOut) {
  const start = localDate(checkIn);
  const end = localDate(checkOut);
  const nights = start && end ? Math.round((end - start) / 86400000) : 0;
  return nights > 0 ? nights : null;
}

function displayPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
    : '—';
}

function referenceFor(id) {
  const sanitized = String(id || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `HYS-${(sanitized || '0000').slice(-8)}`;
}

function cancellationDeadline(checkIn) {
  const date = localDate(checkIn);
  if (!date) return '24 hours before check-in';
  date.setDate(date.getDate() - 1);
  date.setHours(14, 0, 0, 0);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function guestsFor(booking) {
  const adults = Number(booking.adults ?? booking.adult_count);
  const children = Number(booking.children ?? booking.child_count);
  const guests = [];
  if (Number.isFinite(adults) && adults > 0) guests.push(`${adults} adult${adults === 1 ? '' : 's'}`);
  if (Number.isFinite(children) && children > 0) guests.push(`${children} child${children === 1 ? '' : 'ren'}`);
  return guests.length ? guests.join(' · ') : 'Guest details unavailable';
}

function SectionHeading({ icon, title }) {
  return <View style={styles.sectionHeading}><View style={styles.sectionIcon}><Feather name={icon} size={17} color="#489CFC" /></View><Text style={styles.sectionTitle}>{title}</Text></View>;
}

function DetailRow({ icon, label, value, last = false }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <View style={styles.detailIcon}><Feather name={icon} size={17} color="#489CFC" /></View>
      <View style={styles.detailCopy}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>
    </View>
  );
}

function BookingReferenceModal({ booking, visible, onClose }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.referenceModal} onPress={(event) => event.stopPropagation()}>
          <View style={styles.modalHandle} />
          <View style={styles.modalIcon}><Feather name="hash" size={22} color="#489CFC" /></View>
          <Text style={styles.modalTitle}>Booking reference</Text>
          <Text style={styles.referenceCode}>{referenceFor(booking.id)}</Text>
          <Text style={styles.modalDescription}>Share this reference whenever you contact Hoysii about this stay.</Text>
          <TouchableOpacity style={styles.modalButton} onPress={onClose} activeOpacity={0.8}><Text style={styles.modalButtonText}>Done</Text></TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ReceiptModal({ booking, visible, onClose }) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.receiptModal}>
          <View style={styles.modalHandle} />
          <View style={styles.receiptTopRow}>
            <View><Text style={styles.modalTitle}>Payment receipt</Text><Text style={styles.receiptReference}>{referenceFor(booking.id)}</Text></View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close receipt"><Feather name="x" size={20} color="#111827" /></TouchableOpacity>
          </View>
          <View style={styles.receiptDivider} />
          <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Stay</Text><Text style={styles.receiptValue}>{booking.hotels?.name || 'Hotel'}</Text></View>
          <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Dates</Text><Text style={styles.receiptValue}>{displayDate(booking.check_in_date)} – {displayDate(booking.check_out_date)}</Text></View>
          <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Total paid</Text><Text style={styles.receiptTotal}>{displayPrice(booking.total_price)}</Text></View>
          <TouchableOpacity style={styles.modalButton} onPress={onClose} activeOpacity={0.8}><Text style={styles.modalButtonText}>Close receipt</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function UpcomingStay({ booking, onReferencePress, onReceiptPress }) {
  const router = useRouter();
  const hotel = booking.hotels || {};
  const room = booking.rooms || {};
  const hotelImage = room.images?.[0] || hotel.images?.[0];
  const hotelAddress = hotel.address || hotel.location || hotel.city || 'Address available from Hoysii support';
  const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
  const hotelManagedPickup = booking.pickup_managed_by === 'hotel' || booking.hotel_managed_pickup === true;
  const hasDriver = Boolean(booking.driver_name || booking.driver_vehicle || booking.driver_plate);
  const supportMessage = encodeURIComponent(`Hello Hoysii, I need help with booking ${referenceFor(booking.id)}.`);

  const openSupport = () => Linking.openURL(`https://wa.me/${SUPPORT_WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${supportMessage}`);
  const openDriverContact = () => booking.driver_phone && Linking.openURL(`tel:${String(booking.driver_phone).replace(/[^0-9+]/g, '')}`);

  return (
    <View style={styles.stayCard}>
      <View style={styles.confirmedPill}><MaterialCommunityIcons name="check-circle" size={17} color="#15803D" /><Text style={styles.confirmedText}>Booking confirmed</Text></View>
      <TouchableOpacity style={styles.referenceButton} onPress={onReferencePress} activeOpacity={0.75}><Text style={styles.referenceButtonText}>View booking reference</Text><Feather name="chevron-right" size={17} color="#489CFC" /></TouchableOpacity>

      <View style={styles.hotelOverview}>
        {hotelImage ? <Image source={{ uri: hotelImage }} style={styles.hotelImage} resizeMode="cover" /> : <View style={[styles.hotelImage, styles.hotelImageFallback]}><Feather name="home" size={24} color="#489CFC" /></View>}
        <View style={styles.hotelCopy}>
          <Text style={styles.hotelName} numberOfLines={2}>{hotel.name || 'Hotel'}</Text>
          <Text style={styles.roomName} numberOfLines={1}>{room.name || 'Room'}</Text>
          <View style={styles.addressRow}><Feather name="map-pin" size={14} color="#6B7280" /><Text style={styles.addressText} numberOfLines={2}>{hotelAddress}</Text></View>
        </View>
      </View>

      <View style={styles.detailsCard}>
        <DetailRow icon="log-in" label="Check-in" value={`${displayDate(booking.check_in_date)}, 2:00 PM`} />
        <DetailRow icon="log-out" label="Check-out" value={`${displayDate(booking.check_out_date)}, 12:00 PM`} />
        <DetailRow icon="moon" label="Your stay" value={`${nights || '—'} night${nights === 1 ? '' : 's'} · ${guestsFor(booking)}`} last />
      </View>

      <View style={styles.sectionDivider} />
      <SectionHeading icon="navigation" title="Arrival" />
      <View style={styles.arrivalCard}>
        <View style={styles.arrivalRow}>
          <View style={styles.arrivalLabelWrap}><Feather name="airplay" size={18} color="#489CFC" /><View><Text style={styles.arrivalLabel}>Flight</Text><Text style={styles.arrivalValue}>{booking.flight_number || 'Add flight details'}</Text></View></View>
          {!booking.flight_number && <Feather name="chevron-right" size={18} color="#9CA3AF" />}
        </View>
        <View style={styles.arrivalDivider} />
        <View style={styles.arrivalRow}>
          <View style={styles.arrivalLabelWrap}><Feather name="truck" size={18} color="#489CFC" /><View><Text style={styles.arrivalLabel}>Airport pickup</Text><Text style={styles.arrivalValue}>{hotelManagedPickup ? 'Your hotel is arranging your pickup' : booking.pickup_status || 'Add airport pickup'}</Text></View></View>
          {!hotelManagedPickup && !booking.pickup_status && <Feather name="chevron-right" size={18} color="#9CA3AF" />}
        </View>
        <View style={styles.arrivalDivider} />
        <View style={styles.arrivalRow}>
          <View style={styles.arrivalLabelWrap}><Feather name="user" size={18} color="#489CFC" /><View><Text style={styles.arrivalLabel}>Driver</Text><Text style={styles.arrivalValue}>{hasDriver ? 'Driver assigned' : 'Available after pickup is confirmed'}</Text></View></View>
        </View>
        {hasDriver && <View style={styles.driverCard}>
          {booking.driver_name && <DetailRow icon="user" label="Driver" value={booking.driver_name} />}
          {booking.driver_vehicle && <DetailRow icon="truck" label="Vehicle" value={booking.driver_vehicle} />}
          {booking.driver_plate && <DetailRow icon="credit-card" label="Plate" value={booking.driver_plate} />}
          {booking.pickup_status && <DetailRow icon="clock" label="Pickup status" value={booking.pickup_status} />}
          {booking.driver_phone && <TouchableOpacity style={styles.driverContactButton} onPress={openDriverContact} activeOpacity={0.8}><Feather name="phone" size={16} color="#FFFFFF" /><Text style={styles.driverContactText}>Contact driver</Text></TouchableOpacity>}
        </View>}
      </View>

      <View style={styles.sectionDivider} />
      <TouchableOpacity style={styles.paymentRow} onPress={onReceiptPress} activeOpacity={0.75}>
        <View style={styles.paymentCopy}><Text style={styles.paymentLabel}>Total paid</Text><Text style={styles.paymentValue}>{displayPrice(booking.total_price)}</Text></View>
        <View style={styles.paymentAction}><Text style={styles.paymentActionText}>View receipt</Text><Feather name="chevron-right" size={17} color="#489CFC" /></View>
      </TouchableOpacity>

      <View style={styles.sectionDivider} />
      <View style={styles.cancellationCard}>
        <View style={styles.cancellationTopRow}><View style={styles.cancellationTitleWrap}><Feather name="calendar" size={18} color="#489CFC" /><Text style={styles.cancellationTitle}>Cancellation</Text></View><TouchableOpacity onPress={() => router.push('/(modals)/terms')} activeOpacity={0.75}><Text style={styles.policyLink}>View policy</Text></TouchableOpacity></View>
        <Text style={styles.cancellationText}>Free cancellation until {cancellationDeadline(booking.check_in_date)}, 2:00 PM.</Text>
      </View>

      <TouchableOpacity style={styles.supportButton} onPress={openSupport} activeOpacity={0.85}>
        <View style={styles.supportIcon}><MaterialCommunityIcons name="whatsapp" size={22} color="#FFFFFF" /></View>
        <View style={styles.supportCopy}><Text style={styles.supportTitle}>Need help?</Text><Text style={styles.supportSubtitle}>Chat with Hoysii on WhatsApp</Text></View>
        <Feather name="chevron-right" size={19} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

export default function TripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSignedIn, userId, getToken } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [referenceBooking, setReferenceBooking] = useState(null);
  const [receiptBooking, setReceiptBooking] = useState(null);

  useEffect(() => {
    const fetchBookings = async () => {
      if (!isSignedIn || !userId) { setLoading(false); return; }
      try {
        setLoading(true);
        setError(null);
        const token = await getToken({ template: 'supabase' });
        const client = createSupabaseClient(token);
        const { data: userData, error: userError } = await client.from('users').select('id').eq('clerk_id', userId).maybeSingle();
        if (userError || !userData) throw new Error('Could not find user');
        const { data, error: bookingsError } = await client.from('bookings').select('*, hotels (*), rooms (*)').eq('user_id', userData.id).order('created_at', { ascending: false });
        if (bookingsError) throw bookingsError;
        setBookings(data || []);
      } catch (fetchError) {
        console.error('Error fetching bookings:', fetchError);
        setError('We could not load your trips. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [isSignedIn, userId]);

  const upcomingBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return bookings.filter((booking) => {
      const checkOut = localDate(booking.check_out_date);
      return !checkOut || checkOut >= today;
    });
  }, [bookings]);

  if (!isSignedIn) return <View style={[styles.container, { paddingTop: insets.top + 20 }]}><StatusBar style="dark" /><View style={styles.notSignedInContainer}><Feather name="calendar" size={48} color="#6B7280" /><Text style={styles.emptyTitle}>Your trips, in one place</Text><Text style={styles.emptySubtitle}>Sign in to see your stay, payment receipt, and arrival details.</Text><TouchableOpacity style={styles.loginButton} activeOpacity={0.8} onPress={() => router.push('/(modals)/login')}><Text style={styles.loginButtonText}>Log in or sign up</Text></TouchableOpacity></View></View>;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 112 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Trips</Text>
        {loading ? <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#489CFC" /></View> : error ? <View style={styles.emptyContainer}><Feather name="wifi-off" size={42} color="#9CA3AF" /><Text style={styles.emptyTitle}>Trips unavailable</Text><Text style={styles.emptySubtitle}>{error}</Text></View> : upcomingBookings.length === 0 ? <View style={styles.emptyContainer}><Feather name="calendar" size={48} color="#D1D5DB" /><Text style={styles.emptyTitle}>No upcoming stays</Text><Text style={styles.emptySubtitle}>Your confirmed stays will appear here.</Text><TouchableOpacity style={styles.exploreButton} activeOpacity={0.8} onPress={() => router.push('/(tabs)')}><Text style={styles.exploreButtonText}>Explore stays</Text></TouchableOpacity></View> : <View style={styles.staysList}><Text style={styles.upcomingTitle}>Upcoming stay</Text>{upcomingBookings.map((booking) => <UpcomingStay key={booking.id} booking={booking} onReferencePress={() => setReferenceBooking(booking)} onReceiptPress={() => setReceiptBooking(booking)} />)}</View>}
      </ScrollView>
      {referenceBooking && <BookingReferenceModal booking={referenceBooking} visible onClose={() => setReferenceBooking(null)} />}
      {receiptBooking && <ReceiptModal booking={receiptBooking} visible onClose={() => setReceiptBooking(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' }, scrollView: { flex: 1 }, scrollContent: { paddingHorizontal: 20 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, color: '#111827', marginBottom: 22 }, upcomingTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#111827', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 }, staysList: { gap: 14 },
  stayCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, shadowColor: '#111827', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 3 }, confirmedPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99 }, confirmedText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#166534' }, referenceButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingVertical: 4 }, referenceButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#489CFC' },
  hotelOverview: { flexDirection: 'row', gap: 13, marginTop: 18 }, hotelImage: { width: 90, height: 96, borderRadius: 16, backgroundColor: '#E5E7EB' }, hotelImageFallback: { alignItems: 'center', justifyContent: 'center' }, hotelCopy: { flex: 1, justifyContent: 'center' }, hotelName: { fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 23, color: '#111827' }, roomName: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#4B5563', marginTop: 3 }, addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 8 }, addressText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, color: '#6B7280' },
  detailsCard: { marginTop: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12 }, detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 57, borderBottomWidth: 1, borderBottomColor: '#EEF0F2' }, detailRowLast: { borderBottomWidth: 0 }, detailIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EFF6FF' }, detailCopy: { flex: 1 }, detailLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#6B7280' }, detailValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#111827', marginTop: 2 },
  sectionDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 21 }, sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }, sectionIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }, sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#111827' }, arrivalCard: { borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 13 }, arrivalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 }, arrivalLabelWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 }, arrivalLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: '#111827' }, arrivalValue: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#6B7280', marginTop: 3 }, arrivalDivider: { height: 1, backgroundColor: '#EEF0F2' }, driverCard: { borderTopWidth: 1, borderTopColor: '#EEF0F2', paddingTop: 2, paddingBottom: 12 }, driverContactButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, backgroundColor: '#489CFC', paddingHorizontal: 13, paddingVertical: 10, marginTop: 8 }, driverContactText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#FFFFFF' },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, paymentCopy: { gap: 4 }, paymentLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#6B7280' }, paymentValue: { fontFamily: 'Inter_700Bold', fontSize: 23, color: '#111827' }, paymentAction: { flexDirection: 'row', alignItems: 'center', gap: 2 }, paymentActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#489CFC' },
  cancellationCard: { borderRadius: 15, backgroundColor: '#F8FAFC', padding: 14 }, cancellationTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, cancellationTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 }, cancellationTitle: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#111827' }, policyLink: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#489CFC' }, cancellationText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: '#4B5563', marginTop: 9 }, supportButton: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: '#25D366', padding: 15, gap: 11, marginTop: 18 }, supportIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' }, supportCopy: { flex: 1 }, supportTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#FFFFFF' }, supportSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: '#FFFFFF', opacity: 0.9, marginTop: 2 },
  loadingContainer: { alignItems: 'center', paddingTop: 100 }, emptyContainer: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 30, gap: 12 }, emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#111827', textAlign: 'center' }, emptySubtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: '#6B7280', textAlign: 'center' }, loginButton: { backgroundColor: '#489CFC', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, marginTop: 12 }, loginButtonText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#FFFFFF' }, exploreButton: { backgroundColor: '#489CFC', paddingHorizontal: 25, paddingVertical: 13, borderRadius: 12, marginTop: 10 }, exploreButtonText: { fontFamily: 'Inter_700Bold', color: '#FFFFFF', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }, referenceModal: { width: '100%', maxWidth: 360, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 }, receiptModal: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 }, modalHandle: { width: 38, height: 4, borderRadius: 99, backgroundColor: '#D1D5DB', marginBottom: 18 }, modalIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, modalTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: '#111827' }, referenceCode: { fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: 1, color: '#489CFC', marginTop: 11 }, modalDescription: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: '#6B7280', textAlign: 'center', marginTop: 11 }, modalButton: { width: '100%', backgroundColor: '#489CFC', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 21 }, modalButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: '#FFFFFF' }, receiptTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, receiptReference: { fontFamily: 'Inter_500Medium', fontSize: 13, color: '#6B7280', marginTop: 4 }, closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6' }, receiptDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 18 }, receiptRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 15 }, receiptLabel: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 13, color: '#6B7280' }, receiptValue: { flex: 1.4, fontFamily: 'Inter_600SemiBold', fontSize: 13, color: '#111827', textAlign: 'right' }, receiptTotal: { fontFamily: 'Inter_700Bold', fontSize: 18, color: '#111827' }, notSignedInContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
});
