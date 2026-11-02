import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMockBookingStore } from './payment-preview';

export const mockBookings = createMockBookingStore(AsyncStorage);
