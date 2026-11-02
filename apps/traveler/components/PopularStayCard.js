import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { isHotelVerified } from '../lib/hotel-display';
import SaveHotelButton from './SaveHotelButton';

export default function PopularStayCard({ hotel, index, cardWidth, onPress }) {
  // Maintain aspect ratio from Figma (156/191 ≈ 0.82)
  const imageHeight = cardWidth * 0.82;

  return (
      <Animated.View 
        entering={FadeIn.delay(index * 150).duration(400)}
        style={{ width: cardWidth }}
      >
        {/* Image Container */}
        <View style={[styles.imageContainer, { width: cardWidth, height: imageHeight }]}>
          <TouchableOpacity activeOpacity={0.9} onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={`View ${hotel.name}`}>
          {hotel.images?.[0] ? <Image
            source={{ uri: hotel.images[0] }}
            style={{ width: cardWidth, height: imageHeight }}
            resizeMode="cover"
          /> : <View style={{ height: imageHeight, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' }}><Feather name="home" size={24} color="#6B7280" /></View>}
          </TouchableOpacity>
          <SaveHotelButton hotelId={hotel.id} style={{ top: 8, right: 8 }} />
          {isHotelVerified(hotel) && <View pointerEvents="none" style={styles.verifiedBadge}>
            <MaterialCommunityIcons name="shield-check" size={14} color="#489CFC" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>}
        </View>

        {/* Hotel Info */}
        <TouchableOpacity style={styles.infoContainer} activeOpacity={0.9} onPress={onPress} disabled={!onPress}>
          {/* Left Side - Name and Price */}
          <View style={styles.infoLeft}>
            <Text style={styles.hotelName} numberOfLines={1}>{hotel.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>${hotel.starting_price}</Text>
              <Text style={styles.priceLabel}>per night</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  infoLeft: {
    flex: 1,
    gap: 2,
    paddingRight: 8,
  },
  hotelName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter_700Bold',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
  priceLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
  },
  verifiedText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: '#374151' },
});
