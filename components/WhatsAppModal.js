import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Pressable, KeyboardAvoidingView, Platform, TextInput, FlatList, useWindowDimensions } from 'react-native';
// import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Feather } from '@expo/vector-icons';
import { syncUser } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  runOnJS
} from 'react-native-reanimated';

const WHATSAPP_STORAGE_KEY = '@user_whatsapp_number';

// ----------------------------------------------------------------------
// DATA: Country Codes
// ----------------------------------------------------------------------
// List of countries with their dial codes and flags.
// Used in the country picker modal.
// ----------------------------------------------------------------------

// Common countries with dial codes
const COUNTRIES = [
  { code: 'SO', name: 'Somalia', dial: '+252', flag: '🇸🇴' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { code: 'QA', name: 'Qatar', dial: '+974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', dial: '+965', flag: '🇰🇼' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪' },
  { code: 'ET', name: 'Ethiopia', dial: '+251', flag: '🇪🇹' },
  { code: 'DJ', name: 'Djibouti', dial: '+253', flag: '🇩🇯' },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬' },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', dial: '+47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', dial: '+45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', dial: '+358', flag: '🇫🇮' },
];

// ----------------------------------------------------------------------
// COMPONENT: WhatsAppModal
// ----------------------------------------------------------------------
// This modal collects the user's WhatsApp number if it's not already saved.
// It slides up from the bottom and requires a valid number to proceed.
// 
// Props:
// - visible: boolean - Controls modal visibility
// - onClose: function - Called when modal is closed
// - onSuccess: function - Called when number is successfully saved
// ----------------------------------------------------------------------
export default function WhatsAppModal({ visible, onClose, onSuccess }) {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Default to Somalia
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // ----------------------------------------------------------------------
  // ANIMATION
  // ----------------------------------------------------------------------
  // using Reanimated for smooth slide-up/down performance
  const translateY = useSharedValue(SCREEN_HEIGHT);
  
  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  
  // ----------------------------------------------------------------------
  // HELPERS
  // ----------------------------------------------------------------------
  
  // Combines dial code and phone number
  const getFormattedNumber = () => {
    return `${selectedCountry.dial}${phoneNumber.replace(/\s/g, '')}`;
  };
  
  // Checks if number is valid (digits only, enough length)
  const validatePhoneNumber = () => {
    const cleanNumber = phoneNumber.replace(/\s/g, '');
    // Basic validation: at least 6 digits
    return cleanNumber.length >= 6 && /^\d+$/.test(cleanNumber);
  };
  
  // ----------------------------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------------------------

  // Validates and saves the number to local storage and Clerk user metadata
  const handleSave = async () => {
    if (!validatePhoneNumber()) {
      setError('Please enter a valid phone number');
      return;
    }
    
    setSaving(true);
    setError('');
    
    const formattedNumber = getFormattedNumber();
    
    try {
      // Also save to Clerk user metadata if available
      if (user) {
        try {
          // Get the Supabase token
          const token = await getToken({ template: 'supabase' });
          
          await user.update({
            unsafeMetadata: {
              ...user.unsafeMetadata,
              whatsappNumber: formattedNumber,
            },
          });
          
          // Sync to Supabase
          const email = user.primaryEmailAddress?.emailAddress;
          const fullName = user.fullName;
          
          // Force sync with the new number
          await syncUser({
            clerk_id: user.id,
            email,
            full_name: fullName,
            phone_number: formattedNumber
          }, token);

        } catch (clerkError) {
          console.log('Could not save to Clerk metadata or Supabase:', clerkError);
          // If Clerk update fails, we should still try to sync to Supabase directly
           const email = user.primaryEmailAddress?.emailAddress;
           const fullName = user.fullName;
           
           // Try to get token again if needed, or reuse if we got it
           const token = await getToken({ template: 'supabase' });

           await syncUser({
             clerk_id: user.id || '',
             email: email || '',
             full_name: fullName || '',
             phone_number: formattedNumber
           }, token);
        }
      }
      
      // Success callback
      if (onSuccess) {
        onSuccess(formattedNumber);
      }
      
      // Close modal
      handleClose();
    } catch (err) {
      console.error('Error saving WhatsApp number:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Animates modal down before calling onClose prop
  const handleClose = () => {
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 }, () => {
      if (onClose) {
        runOnJS(onClose)();
      }
    });
  };
  
  const handleSelectCountry = (country) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
  };
  
  if (!visible) return null;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <Animated.View style={[styles.modalContent, animatedStyle, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.content}>
            <View style={styles.inputSection}>
              <Text style={styles.label}>WhatsApp Number</Text>
              
              <View style={styles.phoneInputRow}>
                {/* Country Picker Button */}
                <TouchableOpacity 
                  style={styles.countryButton}
                  onPress={() => setShowCountryPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryDial}>{selectedCountry.dial}</Text>
                  <Feather name="chevron-down" size={16} color="#6B7280" />
                </TouchableOpacity>
                
                {/* Phone Number Input */}
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Enter phone number"
                  placeholderTextColor="#6B7280"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoFocus
                />
              </View>
              
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
            
            <Text style={styles.description}>
              To ensure reliable communication in Somalia and a smooth arrival, <Text style={styles.descriptionBold}>our team coordinates your check-in via WhatsApp.</Text>
            </Text>
            
            <TouchableOpacity
              style={[styles.nextButton, (saving || !phoneNumber) && styles.nextButtonDisabled]}
              onPress={handleSave}
              disabled={saving || !phoneNumber}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.nextButtonText}>Next</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
        
        {/* Country Picker Modal */}
        <Modal
          visible={showCountryPicker}
          transparent
          animationType="fade"
          statusBarTranslucent
        >
          <Pressable 
            style={styles.pickerBackdrop} 
            onPress={() => setShowCountryPicker(false)}
          />
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Feather name="x" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    selectedCountry.code === item.code && styles.countryItemSelected
                  ]}
                  onPress={() => handleSelectCountry(item)}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <Text style={styles.countryItemName}>{item.name}</Text>
                  <Text style={styles.countryItemDial}>{item.dial}</Text>
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 38,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  content: {
    alignItems: 'center',
    gap: 20,
  },
  inputSection: {
    width: '100%',
    gap: 10,
  },
  label: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    color: '#111827',
    fontFamily: 'Inter_700Bold',
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.5)',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryDial: {
    fontSize: 14,
    color: '#111827',
    fontFamily: 'Inter_500Medium',
  },
  phoneInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 17,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
    width: '100%',
  },
  descriptionBold: {
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  nextButton: {
    backgroundColor: '#489CFC',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 39,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    minWidth: 209,
  },
  nextButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
    fontFamily: 'Inter_500Medium',
  },
  
  // Country Picker Styles
  pickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: '20%',
    maxHeight: '60%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter_500Medium',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  countryItemSelected: {
    backgroundColor: '#F0FDF4',
  },
  countryItemFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryItemName: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    fontFamily: 'Inter_400Regular',
  },
  countryItemDial: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
});
