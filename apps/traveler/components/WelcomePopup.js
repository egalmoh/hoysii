import { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, useWindowDimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const STORAGE_KEY = '@welcome_popup_shown';

// Local vault/shield animation
const vaultAnimation = require('../assets/animations/vault-save.json');

export default function WelcomePopup() {
  const [visible, setVisible] = useState(false);
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(height);
  const opacity = useSharedValue(0);

  useEffect(() => {
    checkIfShown();
  }, []);

  const checkIfShown = async () => {
    try {
      const hasShown = await AsyncStorage.getItem(STORAGE_KEY);
      if (!hasShown) {
        setTimeout(() => {
          setVisible(true);
          opacity.value = withTiming(1, { duration: 300 });
          translateY.value = withSpring(0, { damping: 50, stiffness: 100 });
        }, 800);
      }
    } catch (error) {
      console.log('Error checking popup status:', error);
    }
  };

  const handleDismiss = async () => {
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(height, { duration: 300 }, () => {
      runOnJS(setVisible)(false);
    });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch (error) {
      console.log('Error saving popup status:', error);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={styles.backdropPressable} onPress={handleDismiss} />
        </Animated.View>

        {/* Popup Card - Centered */}
        <Animated.View style={[styles.popupCard, animatedStyle]}>
          {/* Shield Animation */}
          <View style={styles.animationContainer}>
            <LottieView
              source={vaultAnimation}
              autoPlay
              loop
              style={{ width: 40, height: 40 }}
            />
          </View>

          {/* Message */}
          <View style={styles.messageContainer}>
            <Text style={styles.messageText}>
              We only recommend verified hotels. We guarantee these hotels only.
            </Text>
          </View>

          {/* Close Button */}
          <Pressable onPress={handleDismiss} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={18} color="#6B7280" />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  backdropPressable: {
    flex: 1,
  },
  popupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  animationContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  messageContainer: {
    flex: 1,
  },
  messageText: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    lineHeight: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
