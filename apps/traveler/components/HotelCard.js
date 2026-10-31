import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

const CARD_WIDTH = 280;
const CARD_HEIGHT = 280;

export default function HotelCard({ hotel, index, cardWidth = CARD_WIDTH, cardHeight = CARD_HEIGHT, onPress }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);

  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const imgIndex = Math.round(scrollPosition / cardWidth);
    if (imgIndex !== activeIndex && imgIndex >= 0 && imgIndex < (hotel.images || []).length) {
      setActiveIndex(imgIndex);
    }
  };

  const scrollToIndex = (newIndex) => {
    if (newIndex >= 0 && newIndex < (hotel.images || []).length) {
      scrollRef.current?.scrollTo({ x: newIndex * cardWidth, animated: true });
      setActiveIndex(newIndex);
    }
  };

  const goLeft = () => scrollToIndex(activeIndex - 1);
  const goRight = () => scrollToIndex(activeIndex + 1);

  return (
    <Animated.View 
      entering={FadeIn.delay(index * 700).duration(700)}
      style={[styles.container, { width: cardWidth }]}
    >
      {/* Image Container */}
      <View style={[styles.imageContainer, { width: cardWidth, height: cardHeight }]}>
        {/* Scrollable Images */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate={0.92}
          snapToInterval={cardWidth}
          snapToAlignment="center"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          bounces={true}
          overScrollMode="always"
          nestedScrollEnabled={true}
          style={[styles.scrollView, { width: cardWidth, height: cardHeight }]}
          contentContainerStyle={styles.scrollContent}
        >
          {(hotel.images || []).map((image, imgIdx) => (
            <TouchableOpacity
              key={imgIdx}
              activeOpacity={0.95}
              onPress={onPress}
              disabled={!onPress}
            >
              <Image
                source={{ uri: image }}
                style={[styles.image, { width: cardWidth, height: cardHeight }]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Left Arrow */}
        {activeIndex > 0 && (
          <TouchableOpacity 
            onPress={goLeft}
            style={[styles.arrowButton, styles.arrowLeft]}
          >
            <Feather name="chevron-left" size={16} color="#111827" />
          </TouchableOpacity>
        )}

        {/* Right Arrow */}
        {activeIndex < (hotel.images || []).length - 1 && (
          <TouchableOpacity 
            onPress={goRight}
            style={[styles.arrowButton, styles.arrowRight]}
          >
            <Feather name="chevron-right" size={16} color="#111827" />
          </TouchableOpacity>
        )}

        {/* Dot Indicators */}
        <View style={styles.dotsContainer}>
          {(hotel.images || []).map((_, dotIndex) => (
            <View
              key={dotIndex}
              style={[
                styles.dot,
                { backgroundColor: dotIndex === activeIndex ? '#FFFFFF' : 'rgba(255,255,255,0.4)' },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Hotel Info - Tappable for navigation */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        disabled={!onPress}
        style={styles.infoContainer}
      >
        {/* Left Side - Name, Location, Price */}
        <View style={styles.infoLeft}>
          <Text style={styles.hotelName} numberOfLines={1}>{hotel.name}</Text>
          <Text style={styles.address} numberOfLines={1}>
            {hotel.city}
          </Text>
          <Text style={styles.amenities} numberOfLines={1}>
            {(hotel.amenities || []).join(', ') || 'Security Guard, AC, Work Desk, flat tv, Gym'}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>${hotel.starting_price}</Text>
            <Text style={styles.priceLabel}>per night</Text>
          </View>
        </View>

        {/* Right Side - Verified Badge */}
        {hotel.is_verified && (
          <View style={styles.verifiedBadgeContainer}>
            <View style={styles.verifiedBadge}>
              <MaterialCommunityIcons name="shield-check" size={18} color="#489CFC" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      );
    }




const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
  },
  scrollView: {
  },
  scrollContent: {
    flexDirection: 'row',
  },
  image: {
  },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -12.5, // Half of button height for centering
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: 'rgba(250, 250, 250, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  arrowLeft: {
    left: 8,
  },
  arrowRight: {
    right: 8,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    marginTop: 10,
    
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
  address: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  amenities: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
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
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },
  verifiedBadgeContainer: {
    justifyContent: 'flex-start',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E4E9E8',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#6B7280',
    fontFamily: 'Inter_700Bold',
  },
});
