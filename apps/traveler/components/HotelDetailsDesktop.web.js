import { useEffect, useRef, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import AvailableRoomCard from './AvailableRoomCard';
import HotelReviews from './HotelReviews';
import SaveHotelButton from './SaveHotelButton';
import { hotelOffers, isHotelVerified } from '../lib/hotel-display';

function stayDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Add dates';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function HotelDetailsDesktop({ hotel, rooms, searchParams }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const twoColumns = width >= 1024;
  const pageWidth = Math.min(1120, width - 64);
  const photos = [...new Set((hotel.images || []).filter(Boolean))];
  const photoEntries = photos.map((uri, index) => ({ uri, index }));
  const secondaryPhotos = photoEntries.slice(1, 5);
  const previewRows = secondaryPhotos.length > 2
    ? [secondaryPhotos.slice(0, 2), secondaryPhotos.slice(2)]
    : secondaryPhotos.map(photo => [photo]);
  const allPhotoRows = photoEntries.reduce((rows, photo, index) => {
    if (index === 0 || index % 2 === 1) rows.push([photo]);
    else rows[rows.length - 1].push(photo);
    return rows;
  }, []);
  const galleryHeight = Math.min(420, Math.round(pageWidth * 0.4));
  const offers = hotelOffers(hotel);
  const address = Array.isArray(hotel.address) ? hotel.address.filter(Boolean).join(', ') : hotel.address || '';
  const prices = rooms.map(room => Number(room.price)).filter(price => Number.isFinite(price) && price >= 0);
  const startingPrice = prices.length ? Math.min(...prices) : null;
  const guestCount = (Number(searchParams.adults) || 1) + (Number(searchParams.children) || 0);
  const [photoIndex, setPhotoIndex] = useState(null);
  const scrollRef = useRef(null);
  const photoScrollRef = useRef(null);
  const photoRowOffsets = useRef(new Map());

  useEffect(() => {
    setPhotoIndex(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [hotel.id]);

  useEffect(() => {
    if (photoIndex === null) return;
    const onKeyDown = event => {
      if (event.key === 'Escape') setPhotoIndex(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photoIndex]);

  const scrollToPhoto = () => photoScrollRef.current?.scrollTo({
    y: Math.max(0, (photoRowOffsets.current.get(photoIndex) || 0) - 24),
    animated: false,
  });
  const photoTile = (photo, index, style) => (
    <TouchableOpacity key={`${index}-${photo}`} accessibilityRole="button" accessibilityLabel={`View hotel photo ${index + 1} of ${photos.length}`}
      onPress={() => setPhotoIndex(index)} activeOpacity={0.9} style={[styles.photoTile, style]}>
      <Image source={{ uri: photo }} accessibilityLabel={`${hotel.name} · photo ${index + 1}`} resizeMode="cover" style={styles.photo} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.page, { width: pageWidth }]}>
          <View style={styles.titleRow}>
            <Text accessibilityRole="header" style={styles.title}>{hotel.name}</Text>
            <View style={styles.titleActions}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to previous screen" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.back}>
                <Feather name="arrow-left" size={17} color="#111827" /><Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
              <SaveHotelButton hotelId={String(hotel.id)} style={styles.save} />
            </View>
          </View>
          {address ? <View style={styles.addressRow}><Feather name="map-pin" size={16} color="#6B7280" /><Text style={styles.address}>{address}</Text></View> : null}

          <View testID="hotel-photo-gallery" style={[styles.gallery, { height: galleryHeight }]}>
            {photos.length === 0 ? <View style={styles.photoPlaceholder}><Feather name="home" size={36} color="#6B7280" /><Text style={styles.muted}>Hotel photo coming soon</Text></View> : <>
              {photoTile(photos[0], 0, { flex: secondaryPhotos.length ? 1 : undefined, width: secondaryPhotos.length ? undefined : '100%' })}
              {secondaryPhotos.length > 0 && <View style={[styles.secondaryPhotos, { flex: photos.length === 2 ? 0.65 : 1 }]}>
                {previewRows.map(row => <View key={row[0].index} style={styles.previewPhotoRow}>
                  {row.map(photo => photoTile(photo.uri, photo.index, { flex: 1 }))}
                </View>)}
              </View>}
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Show all hotel photos" onPress={() => setPhotoIndex(0)} style={styles.allPhotos}>
                <Feather name="grid" size={16} color="#111827" /><Text style={styles.actionText}>Show all photos{photos.length > 1 ? ` (${photos.length})` : ''}</Text>
              </TouchableOpacity>
            </>}
          </View>

          <View style={[styles.body, twoColumns && styles.bodyColumns]}>
            <View style={styles.mainColumn}>
              <View style={styles.introduction}>
                <Text style={styles.sectionTitle}>Hotel{hotel.city ? ` in ${hotel.city}` : ''}</Text>
                {isHotelVerified(hotel) && <View style={styles.verifiedBadge}><MaterialCommunityIcons name="shield-check" size={22} color="#489CFC" /><Text style={styles.verifiedText}>VERIFIED BY HOYSII TEAM</Text></View>}
                {hotel.description ? <Text style={styles.description}>{hotel.description}</Text> : null}
              </View>
              {offers.length > 0 && <View style={styles.section}>
                <Text style={styles.sectionTitle}>What this hotel offers</Text>
                <View style={styles.offers}>
                  {offers.map(offer => <View key={offer.id} style={styles.offer}>
                    <MaterialCommunityIcons name={offer.icon} size={24} color="#4B5563" /><Text style={styles.offerLabel}>{offer.label}</Text>
                  </View>)}
                </View>
              </View>}
              <View testID="hotel-available-rooms" style={styles.section}>
                <Text style={styles.sectionTitle}>Availability</Text>
                <Text style={styles.muted}>Choose a room for your stay</Text>
                <View style={styles.rooms}>
                  {rooms.length === 0 && <Text style={styles.description}>No rooms are available for these dates. Try different dates.</Text>}
                  {rooms.map(room => <AvailableRoomCard key={room.id} room={room} hotel={hotel} searchParams={searchParams} />)}
                </View>
              </View>
              <HotelReviews hotelId={String(hotel.id)} />
            </View>

            <View style={[styles.summaryColumn, twoColumns ? styles.summaryColumnWide : styles.summaryColumnTablet]}>
              <View style={[styles.summary, twoColumns && styles.summarySticky]}>
                {startingPrice !== null ? <View style={styles.priceRow}><Text style={styles.price}>From ${startingPrice}</Text><Text style={styles.muted}> / night</Text></View> : <Text style={styles.sectionTitle}>Your stay</Text>}
                <Text style={styles.rateCaption}>Room rate · total and service fee shown at checkout</Text>
                <View style={styles.stayFields}>
                  <View style={styles.datesRow}>
                    <View style={styles.stayField}><Text style={styles.fieldLabel}>CHECK-IN</Text><Text style={styles.fieldValue}>{stayDate(searchParams.checkIn)}</Text></View>
                    <View style={[styles.stayField, styles.checkoutField]}><Text style={styles.fieldLabel}>CHECK-OUT</Text><Text style={styles.fieldValue}>{stayDate(searchParams.checkOut)}</Text></View>
                  </View>
                  <View style={[styles.stayField, styles.guestField]}><Text style={styles.fieldLabel}>GUESTS</Text><Text style={styles.fieldValue}>{guestCount} guest{guestCount === 1 ? '' : 's'}</Text></View>
                </View>
                <Text style={styles.summaryNote}>Select your room to continue to checkout.</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={photoIndex !== null} animationType="fade" onShow={scrollToPhoto} onRequestClose={() => setPhotoIndex(null)}>
        <View accessibilityViewIsModal style={styles.viewer}>
          <View style={styles.viewerHeader}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close hotel photos" onPress={() => setPhotoIndex(null)} style={styles.viewerClose}><Feather name="x" size={23} color="#111827" /><Text style={styles.viewerText}>Close</Text></TouchableOpacity>
            <Text accessibilityRole="header" numberOfLines={1} style={styles.viewerTitle}>{hotel.name}</Text>
            <Text style={styles.viewerText}>{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</Text>
          </View>
          <ScrollView ref={photoScrollRef} testID="hotel-all-photos" style={styles.scroll} contentContainerStyle={styles.allPhotoContent}>
            <View style={[styles.allPhotoGrid, { width: pageWidth }]}>
              {allPhotoRows.map(row => <View key={row[0].index} style={styles.allPhotoRow}
                onLayout={event => {
                  row.forEach(photo => photoRowOffsets.current.set(photo.index, event.nativeEvent.layout.y));
                  if (row.some(photo => photo.index === photoIndex)) scrollToPhoto();
                }}>
                {row.map(photo => <View key={photo.index} testID={`hotel-all-photo-${photo.index + 1}`} style={styles.allPhotoTile}>
                  <Image source={{ uri: photo.uri }} accessibilityLabel={`${hotel.name} · photo ${photo.index + 1}`} resizeMode="contain" style={styles.photo} />
                </View>)}
              </View>)}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingBottom: 64 },
  page: { paddingTop: 22 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#111827' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24 },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  title: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 38, color: '#111827' },
  save: { position: 'relative', top: 0, right: 0, flexShrink: 0 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 24 },
  address: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: '#6B7280' },
  gallery: { flexDirection: 'row', gap: 8, borderRadius: 16, overflow: 'hidden', marginTop: 8, backgroundColor: '#F3F4F6' },
  photoTile: { minWidth: 0, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  secondaryPhotos: { gap: 8, minWidth: 0 },
  previewPhotoRow: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 0 },
  allPhotos: { position: 'absolute', bottom: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#111827', borderRadius: 8, backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 15 },
  actionText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: '#111827' },
  body: { marginTop: 36, gap: 32 },
  bodyColumns: { flexDirection: 'row', gap: 64, alignItems: 'flex-start' },
  mainColumn: { flex: 1, minWidth: 0 },
  introduction: { gap: 18, paddingBottom: 28 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 30, color: '#111827' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#E4E9E8', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 28 },
  verifiedText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: '#6B7280' },
  description: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 26, color: '#4B5563' },
  section: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingVertical: 28, gap: 16 },
  offers: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 24, marginTop: 8 },
  offer: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 16 },
  offerLabel: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23, color: '#4B5563' },
  rooms: { gap: 16 },
  summaryColumn: { width: '100%' },
  summaryColumnWide: { width: 340, alignSelf: 'stretch' },
  summaryColumnTablet: { order: -1 },
  summary: { borderWidth: 1, borderColor: '#E1E3E6', borderRadius: 16, padding: 24, gap: 16, backgroundColor: '#FFFFFF', boxShadow: '0 6px 24px rgba(17, 24, 39, 0.09)' },
  summarySticky: { position: 'sticky', top: 24 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  price: { fontFamily: 'Inter_700Bold', fontSize: 24, color: '#111827' },
  muted: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: '#6B7280' },
  rateCaption: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, color: '#6B7280' },
  stayFields: { borderWidth: 1, borderColor: '#B5BAC2', borderRadius: 10, overflow: 'hidden' },
  datesRow: { flexDirection: 'row' },
  stayField: { flex: 1, minWidth: 0, padding: 12, gap: 5 },
  checkoutField: { borderLeftWidth: 1, borderLeftColor: '#B5BAC2' },
  guestField: { borderTopWidth: 1, borderTopColor: '#B5BAC2' },
  fieldLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, color: '#111827' },
  fieldValue: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, color: '#4B5563' },
  summaryNote: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, color: '#6B7280', textAlign: 'center' },
  viewer: { flex: 1, backgroundColor: '#FFFFFF' },
  viewerHeader: { flexShrink: 0, paddingHorizontal: 32, paddingVertical: 16, gap: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  viewerClose: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  viewerTitle: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 20, color: '#111827', textAlign: 'center' },
  viewerText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: '#111827' },
  allPhotoContent: { alignItems: 'center', paddingVertical: 24 },
  allPhotoGrid: { gap: 12 },
  allPhotoRow: { flexDirection: 'row', gap: 12 },
  allPhotoTile: { flex: 1, minWidth: 0, aspectRatio: 1.5, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F3F4F6' },
});
