import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Payment Methods Data
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

export default function PaymentSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedMethod, setSelectedMethod] = useState('');

  const handleSelectPayment = async (method) => {
    setSelectedMethod(method.id);
    
    // Store payment selection for booking screen to read
    await AsyncStorage.setItem('selectedPaymentMethod', JSON.stringify({
      id: method.id,
      name: method.name
    }));
    
    // Go back to the existing booking screen
    setTimeout(() => {
        router.back();
    }, 300);
  };

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
          style={[styles.headerGradient, { paddingTop: insets.top + 10 }]}
        >
          {/* Top Row: Back + Title */}
          <View style={styles.topRow}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Payments</Text>
            <View style={{ width: 40 }} />
          </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>
          Choose payment methods:
        </Text>

        <View style={styles.methodList}>
          {PAYMENT_METHODS.map((method) => {
            const isSelected = selectedMethod === method.id;
            
            return (
              <TouchableOpacity
                key={method.id}
                style={[styles.paymentCard, isSelected && styles.paymentCardSelected]}
                onPress={() => handleSelectPayment(method)}
                activeOpacity={0.9}
              >
                {/* Left Side: Icon/Image + Name */}
                <View style={styles.cardContent}>
                  <View style={styles.iconWrapper}>
                    <Image 
                        source={method.image} 
                        width={40}
                        height={40}
                        style={styles.providerLogo}
                        resizeMode="contain"
                    />
                  </View>
                  
                  <Text style={styles.methodName}>{method.name}</Text>
                </View>

                {/* Right Side: Radio Button */}
                <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                    {isSelected && <View style={styles.radioButtonInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerWrapper: {
  },
  headerGradient: {
    paddingBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#6B728050',
  },
  backButton: {
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
  content: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    marginBottom: 18,
  },
  methodList: {
    gap: 12,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(107, 114, 128, 0.5)',
    borderRadius: 15,
    height: 70, // Fixed height from Figma
    paddingRight: 23,
  },
  paymentCardSelected: {
    borderColor: '#489CFC',
    borderWidth: 1.5,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  iconWrapper: {
    paddingTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
    
  },
  cardIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardLogos: {
    flexDirection: 'row',
    gap: 4,
  },
  providerLogo: {
    width: 90,
    height: 90,
  },
  methodName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#111827',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB', // Gray border
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#489CFC', // Dark border when selected
  },
  radioButtonInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#489CFC', // Dark fill
  },
});
