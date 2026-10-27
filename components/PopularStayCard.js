import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function PopularStayCard({ hotel, index, cardWidth, onPress }) {
  // Maintain aspect ratio from Figma (156/191 ≈ 0.82)
  const imageHeight = cardWidth * 0.82;

  return (
    <TouchableOpacity 
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!onPress}
    >
      <Animated.View 
        entering={FadeIn.delay(index * 150).duration(400)}
        style={{ width: cardWidth }}
      >
        {/* Image Container */}
        <View style={[styles.imageContainer, { width: cardWidth, height: imageHeight }]}>
          <Image
            source={{ uri: hotel.images?.[0] || hotel.images?.[1] || hotel.images?.[2] || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600' }}
            style={{ width: cardWidth, height: imageHeight }}
            resizeMode="cover"
          />
        </View>

        {/* Hotel Info */}
        <View style={styles.infoContainer}>
          {/* Left Side - Name and Price */}
          <View style={styles.infoLeft}>
            <Text style={styles.hotelName} numberOfLines={1}>{hotel.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>${hotel.starting_price}</Text>
              <Text style={styles.priceLabel}>per night</Text>
            </View>
          </View>

          {/* Right Side - Verified Badge */}
          {hotel.is_verified && (
            <View style={styles.verifiedBadge}>
              <MaterialCommunityIcons name="shield-check" size={18} color="#489CFC" />
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
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
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: '#E4E9E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
