import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import React from 'react';

export default function AvailableRoomCard({ room, hotel, searchParams = {} }) {
  const router = useRouter();

  const handleBookPress = () => {
    router.push({
      pathname: '/(modals)/booking',
      params: {
        hotelId: String(hotel?.id || ''),
        hotelName: hotel?.name || '',
        hotelLocation: hotel?.location || '',
        hotelImage: hotel?.images?.[0] || hotel?.images?.[1] || hotel?.images?.[2] || '',
        roomId: String(room?.id || ''),
        roomName: room?.name || '',
        // room.image can be a string (already resolved) or array - handle both cases
        roomImage: typeof room?.image === 'string' ? room.image : (room?.image?.[0] || room?.image?.[1] || room?.image?.[2] || ''),
        roomPrice: String(room?.price || ''),
        // Pass search params to booking
        checkIn: searchParams.checkIn,
        checkOut: searchParams.checkOut,
        adults: searchParams.adults,
        children: searchParams.children,
        address: typeof hotel?.address === 'string' ? hotel.address : (hotel?.address?.[0] || hotel?.address?.[1] || ''),
      },
    });
  };

  return (
    <View style={styles.roomCard}>
      <View style={styles.roomCardContent}>
        <Image
          source={{ uri: room.image }}
          style={styles.roomImage}
          resizeMode="cover"
        />

        <View style={styles.roomDetails}>
          <View style={styles.roomInfo}>
            <Text style={styles.roomName}>{room.name}</Text>
            <Text style={styles.roomBedSize}>{room.bedSize}</Text>
            <Text style={styles.roomAmenities}>{room.amenities || ''}</Text>
          </View>

          <View style={styles.roomPriceAndBook}>
            <View style={styles.roomPriceRow}>
              <Text style={styles.roomPrice}>${room.price}</Text>
              <Text style={styles.roomPriceLabel}>per night</Text>
            </View>

            <TouchableOpacity
              style={styles.bookButton}
              activeOpacity={0.8}
              onPress={handleBookPress}
            >
              <Text style={styles.bookButtonText}>Book</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  roomCard: {
    width: '100%',
    minHeight: 130,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderColor: '#6B728020',
    borderWidth: 0.75,
  },
  roomCardContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    minHeight: 130,
    
  },
  roomImage: {
    width: 147,
    height: '100%',
    borderRadius: 20,
  },
  roomDetails: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flex: 1,
    paddingLeft: 7,
    paddingRight: 5,
    paddingVertical: 5,
    minHeight: 135,
    
  },
  roomInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: 4,
  },
  roomName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    color: '#111827',
    marginBottom: 3,
  },
  roomBedSize: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#6B7280',
    marginBottom: 2,
  },
  roomAmenities: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: '#6B7280',
  },
  roomPriceAndBook: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  roomPriceRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomPrice: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    color: '#111827',
    marginRight: 3,
  },
  roomPriceLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
    color: '#6B7280',
  },
  bookButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 24,
    minWidth: 90,
    height: 32,
    backgroundColor: '#489CFC',
    borderRadius: 18,
  },
  bookButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    color: '#FFFFFF',
  },

});