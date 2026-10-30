import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, useUser, authClient } from '../../lib/auth';
import { syncUser } from '../../lib/api';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DISMISS_THRESHOLD = 40;

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded } = useAuth();
  const { user: authUser } = useUser();
  
  const isSignInLoaded = isLoaded;
  const isSignUpLoaded = isLoaded;
  
  // UI State
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'apple' | null
  const [error, setError] = useState('');
  
  // Verification state (for email verification)
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  // 2FA state
  const [pending2FA, setPending2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorMethod, setTwoFactorMethod] = useState(null);
  
  // Animation
  const translateY = useSharedValue(400);

  // Get the redirect path from params (if coming from booking)
  const redirectTo = params.redirectTo;

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 300 });
  }, []);

  // If user is already signed in, navigate away
  useEffect(() => {
    if (isSignedIn && authUser) {
      handleSuccessfulAuth();
    }
  }, [isSignedIn, authUser?.id]);

  const close = () => {
    router.back();
  };

  const handleSuccessfulAuth = useCallback(async () => {
      
      if (authUser) {
        const email = authUser.primaryEmailAddress?.emailAddress;
        const fullName = authUser.fullName;
        const phone = authUser.primaryPhoneNumber?.phoneNumber;
        
        try {
          await syncUser({
            email,
            full_name: fullName,
            phone_number: phone
          });
        } catch (err) {
          console.error('Sync error in handleSuccessfulAuth:', err);
        }

        // Check if there are stored OAuth redirect params (from before app reload)
        let savedRedirectTo = redirectTo;
        let savedParams = params;
        let wasOAuthReload = false;
        
        try {
          const storedOAuthParams = await AsyncStorage.getItem('oauthRedirectParams');
          if (storedOAuthParams) {
            wasOAuthReload = true;
            const parsed = JSON.parse(storedOAuthParams);
            savedRedirectTo = parsed.redirectTo;
            savedParams = parsed.params;
            // Clear the stored params
            await AsyncStorage.removeItem('oauthRedirectParams');
          }
        } catch (err) {
          console.error('Error retrieving OAuth params:', err);
        }

        // Allow the auth session to update before navigating.
        setTimeout(() => {
          // If there's a redirect path (e.g., booking modal), just go back to close this modal
          // The booking screen is still in the navigation stack and will detect the auth state change
          if (savedRedirectTo) {
            // Check if we came from OAuth (app reload) - need to use replace
            // Otherwise just go back to close the modal and return to existing screen
            if (wasOAuthReload) {
              // OAuth caused app reload, need to navigate to booking with full params
              router.replace({
                pathname: savedRedirectTo,
                params: {
                    hotelId: savedParams.hotelId || '',
                    roomId: savedParams.roomId || '',
                    hotelName: savedParams.hotelName || '',
                    roomName: savedParams.roomName || '',
                    hotelImage: savedParams.hotelImage || '',
                    roomImage: savedParams.roomImage || '',
                    checkIn: savedParams.checkIn || '',
                    checkOut: savedParams.checkOut || '',
                    adults: savedParams.adults || '1',
                    children: savedParams.children || '0',
                    roomPrice: savedParams.roomPrice || '',
                    location: savedParams.location || '',
                    address: savedParams.address || '',
                    showWhatsAppCheck: 'true',
                }
              });
            } else {
              // Normal login (no app reload) - just close the modal
              router.back();
            }
          } else {
            // Navigate to home tabs instead of going back (avoids GO_BACK error)
            router.replace('/(tabs)');
          }
        }, 300); // 300ms delay for auth state to settle
      } else {
        console.error('handleSuccessfulAuth: authUser is missing!');
      }
  }, [redirectTo, router, params, authUser, isSignedIn]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD) {
        translateY.value = withTiming(400, { duration: 200 }, () => {
          runOnJS(close)();
        });
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleClose = () => {
    translateY.value = withTiming(400, { duration: 200 }, () => {
      runOnJS(close)();
    });
  };
  const handleGoogleSignIn = async () => {

    try {
      setOauthLoading('google');
      setError('');

      // Store redirect params before OAuth (app will reload in Expo Go)
      if (redirectTo) {
        try {
          await AsyncStorage.setItem('oauthRedirectParams', JSON.stringify({
            redirectTo,
            params
          }));
        } catch (err) {
          console.error('Error storing OAuth params:', err);
        }
      }

      const { error: authError } = await authClient.signIn.social({ provider: 'google', callbackURL: '/login' });
      if (authError) throw new Error(authError.message);
    } catch (err) {
      console.error('Google sign in error:', err);
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setOauthLoading(null);
    }
  };

  // OAuth with Apple
  const handleAppleSignIn = async () => {
    try {
      setOauthLoading('apple');
      setError('');

      // Store redirect params before OAuth (app will reload in Expo Go)
      if (redirectTo) {
        try {
          await AsyncStorage.setItem('oauthRedirectParams', JSON.stringify({
            redirectTo,
            params
          }));
        } catch (err) {
          console.error('Error storing OAuth params:', err);
        }
      }

      const { error: authError } = await authClient.signIn.social({ provider: 'apple', callbackURL: '/login' });
      if (authError) throw new Error(authError.message);
    } catch (err) {
      console.error('Apple sign in error:', err);
      setError(err.message || 'Failed to sign in with Apple.');
    } finally {
      setOauthLoading(null);
    }
  };

  // Sign In Handler
  const handleSignIn = async () => {
    if (!isSignInLoaded || !email || !password) return;
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await authClient.signIn.email({ email: email.trim(), password });
      if (authError) throw new Error(authError.message);
      // The session hook closes this modal once Better Auth has updated it.
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err.message || 'Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Sign Up Handler
  const handleSignUp = async () => {
    if (!isSignUpLoaded || !email || !password) return;
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: `${firstName} ${lastName}`.trim() || email.split('@')[0],
        callbackURL: '/login',
      });
      if (authError) throw new Error(authError.message);
      setPendingVerification(true);
    } catch (err) {
      setError(err.message || 'Failed to sign up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Verify Email Handler
  const handleVerifyEmail = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await authClient.getSession();
      if (authError) throw new Error(authError.message);
      if (!data?.user) setError('Open the verification link in your email, then sign in.');
      else setPendingVerification(false);
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message || 'Could not verify your session.');
    } finally {
      setLoading(false);
    }
  };

  // Verify 2FA Handler
  const handleVerify2FA = async () => {
    setError('Two-factor sign-in is not configured yet. Please contact support.');
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError('');
    setPendingVerification(false);
    setPending2FA(false);
    setTwoFactorCode('');
  };

  // Render 2FA verification form
  if (pending2FA) {
    return (
      <GestureHandlerRootView style={styles.root}>
          <KeyboardAvoidingView 
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable style={styles.backdrop} onPress={handleClose} />
            
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.modalContent, animatedStyle, { paddingBottom: 40 + insets.bottom }]}>
                <View style={styles.dragHandle} />
                
                <Text style={styles.title}>Two-Factor Authentication</Text>
                <Text style={styles.subtitle}>
                  {twoFactorMethod === 'totp' 
                    ? 'Enter the code from your authenticator app'
                    : 'Enter the verification code sent to your device'}
                </Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter code"
                    placeholderTextColor="#9CA3AF"
                    value={twoFactorCode}
                    onChangeText={setTwoFactorCode}
                    keyboardType="number-pad"
                    autoFocus
                    maxLength={6}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  onPress={handleVerify2FA}
                  disabled={loading || !twoFactorCode}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Verify</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => {
                  setPending2FA(false);
                  setTwoFactorCode('');
                  setError('');
                }} style={styles.switchModeButton}>
                  <Text style={styles.switchModeText}>Go back</Text>
                </TouchableOpacity>
              </Animated.View>
            </GestureDetector>
          </KeyboardAvoidingView>
      </GestureHandlerRootView>
    );
  }

  // Render verification form
  if (pendingVerification) {
    return (
      <GestureHandlerRootView style={styles.root}>
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.backdrop} onPress={handleClose} />
          
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.modalContent, animatedStyle, { paddingBottom: 40 + insets.bottom }]}>
              <View style={styles.dragHandle} />
              
              <Text style={styles.title}>Verify your email</Text>
              <Text style={styles.subtitle}>
                We sent a verification link to {email}. Open that link, then sign in.
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleVerifyEmail}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>I opened the link</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setPendingVerification(false)} style={styles.switchModeButton}>
                <Text style={styles.switchModeText}>Go back</Text>
              </TouchableOpacity>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.modalContent, animatedStyle, { paddingBottom: 40 + insets.bottom }]}>
            <View style={styles.dragHandle} />
            
            <Text style={styles.title}>
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signin' 
                ? 'Sign in to continue to Hoysii' 
                : 'Sign up to book your stay'}
            </Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <ScrollView 
              style={styles.formScrollView}
              contentContainerStyle={styles.formContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* OAuth Buttons */}
              <View style={styles.oauthContainer}>
                {/* Google Sign In */}
                <TouchableOpacity
                  style={styles.oauthButton}
                  onPress={handleGoogleSignIn}
                  disabled={oauthLoading !== null}
                  activeOpacity={0.7}
                >
                  {oauthLoading === 'google' ? (
                    <ActivityIndicator color="#111827" size="small" />
                  ) : (
                    <>
                      <View style={styles.googleIconContainer}>
                        <Image source={require('../../assets/Images/google.png')} style={styles.googleIcon} />
                      </View>
                      <Text style={styles.oauthButtonText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Apple Sign In - only show on iOS */}
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.oauthButton, styles.appleButton]}
                    onPress={handleAppleSignIn}
                    disabled={oauthLoading !== null}
                    activeOpacity={0.7}
                  >
                    {oauthLoading === 'apple' ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="apple" size={20} color="#FFFFFF" />
                        <Text style={[styles.oauthButtonText, styles.appleButtonText]}>Continue with Apple</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* Show Apple on Android too, but with different styling */}
                {Platform.OS === 'android' && (
                  <TouchableOpacity
                    style={[styles.oauthButton, styles.appleButton]}
                    onPress={handleAppleSignIn}
                    disabled={oauthLoading !== null}
                    activeOpacity={0.7}
                  >
                    {oauthLoading === 'apple' ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="apple" size={20} color="#FFFFFF" />
                        <Text style={[styles.oauthButtonText, styles.appleButtonText]}>Continue with Apple</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with email</Text>
                <View style={styles.dividerLine} />
              </View>

              {mode === 'signup' && (
                <View style={styles.nameRow}>
                  <View style={[styles.inputContainer, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>First Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="John"
                      placeholderTextColor="#9CA3AF"
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={[styles.inputContainer, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Last Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Doe"
                      placeholderTextColor="#9CA3AF"
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                    />
                  </View>
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="••••••••"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity 
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Feather 
                      name={showPassword ? 'eye-off' : 'eye'} 
                      size={20} 
                      color="#6B7280" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={mode === 'signin' ? handleSignIn : handleSignUp}
                disabled={loading || !email || !password}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {mode === 'signin' ? 'Sign In' : 'Sign Up'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={switchMode} style={styles.switchModeButton}>
                <Text style={styles.switchModeText}>
                  {mode === 'signin' 
                    ? "Don't have an account? Sign up" 
                    : 'Already have an account? Sign in'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  dragHandle: {
    width: 48,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#111827',
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  formScrollView: {
    flexGrow: 0,
  },
  formContainer: {
    gap: 16,
    paddingBottom: 16,
  },
  
  // OAuth Styles
  oauthContainer: {
    gap: 12,
  },
  oauthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  oauthButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    fontFamily: 'Inter_500Medium',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  appleButtonText: {
    color: '#FFFFFF',
  },
  
  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'Inter_400Regular',
  },

  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    fontFamily: 'Inter_500Medium',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    fontFamily: 'Inter_400Regular',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    top: 14,
  },
  submitButton: {
    backgroundColor: '#489CFC',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_500Medium',
  },
  switchModeButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchModeText: {
    color: '#489CFC',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
})
