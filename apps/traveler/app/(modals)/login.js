import { useState, useEffect, useCallback, useRef } from 'react';
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
const CODE_REQUESTED_NOTICE = 'Code requested. Email can take a few minutes; check your inbox and spam folder.';
const CODE_SEND_ERROR = 'We could not send the code right now. Please try again in a moment.';
const CODE_RATE_LIMIT_ERROR = 'Too many code requests. Wait a minute before trying again. An earlier code may still work.';

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
  const [notice, setNotice] = useState('');
  
  // Verification state (for email verification)
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  const [recoveryStep, setRecoveryStep] = useState(null); // 'request' | 'reset'
  const [newPassword, setNewPassword] = useState('');
  const handledAuthRef = useRef(false);
  
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
      if (authUser && !handledAuthRef.current) {
        handledAuthRef.current = true;
        const email = authUser.primaryEmailAddress?.emailAddress;
        const fullName = authUser.fullName;
        const phone = authUser.primaryPhoneNumber?.phoneNumber;
        
        // Profile sync must not hold the traveler on the sign-in screen.
        syncUser({ email, full_name: fullName, phone_number: phone })
          .catch((err) => console.error('Sync error in handleSuccessfulAuth:', err));

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
    if (!isSignInLoaded || !email.trim() || !password) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const { error: authError } = await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
      if (authError) {
        if (authError.status === 429) {
          setError(CODE_RATE_LIMIT_ERROR);
          return;
        }
        if (authError.code === 'EMAIL_SEND_FAILED') {
          setVerificationCode('');
          setPendingVerification(true);
          setError(CODE_SEND_ERROR);
          return;
        }
        if (authError.code === 'EMAIL_NOT_VERIFIED' || /email not verified/i.test(authError.message || '')) {
          setVerificationCode('');
          setPendingVerification(true);
          setNotice(CODE_REQUESTED_NOTICE);
          return;
        }
        throw new Error(authError.code === 'INVALID_EMAIL_OR_PASSWORD' ? 'Email or password is incorrect.' : authError.message);
      }
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
    if (!isSignUpLoaded || !email.trim() || !password) return;
    if (password.length < 8) { setError('Use a password of at least 8 characters.'); return; }
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const { error: authError } = await authClient.signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: `${firstName} ${lastName}`.trim() || email.split('@')[0],
      });
      if (authError?.code === 'EMAIL_SEND_FAILED') {
        // Better Auth has already created the account; allow a safe resend.
        setVerificationCode('');
        setPendingVerification(true);
        setError(CODE_SEND_ERROR);
        return;
      }
      if (authError?.status === 429) {
        setError(CODE_RATE_LIMIT_ERROR);
        return;
      }
      if (authError) throw new Error(authError.message);
      // Better Auth returns a generic signup response for an existing email.
      // Password sign-in distinguishes an already-verified account from one
      // that actually needs a code, without claiming an email was sent.
      setMode('signin');
      await handleSignIn();
    } catch (err) {
      setError(err.message || 'Could not create your account. If you already signed up, switch to Sign in.');
    } finally {
      setLoading(false);
    }
  };

  // Verify Email Handler
  const handleVerifyEmail = async () => {
    if (!/^\d{6}$/.test(verificationCode.trim())) { setError('Enter the 6-digit code from your email.'); return; }
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await authClient.emailOtp.verifyEmail({ email: email.trim().toLowerCase(), otp: verificationCode.trim() });
      if (authError) throw new Error(authError.message);
      setPendingVerification(false);
      setMode('signin');
      setVerificationCode('');
      setNotice('Email verified. Signing you in…');
      const { data } = await authClient.getSession();
      if (data?.user) authClient.$store.notify('$sessionSignal');
      else setNotice('Email verified. Please sign in.');
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message || 'The code is invalid or expired. Request a new one.');
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      // A successful password sign-in means an earlier email verification already worked.
      // For an unverified account, Better Auth sends the code on this sign-in attempt.
      const { error: authError } = await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
      if (!authError) {
        setPendingVerification(false);
        setNotice('Signed in. Opening your account…');
        return;
      }
      if (authError.status === 429) {
        setError(CODE_RATE_LIMIT_ERROR);
        return;
      }
      if (authError.code === 'EMAIL_SEND_FAILED') {
        setError(CODE_SEND_ERROR);
        return;
      }
      if (authError.code === 'EMAIL_NOT_VERIFIED' || /email not verified/i.test(authError.message || '')) {
        setNotice('Code requested again. An earlier code should still work if it has not expired. Email can take a few minutes.');
        return;
      }
      throw new Error(authError.code === 'INVALID_EMAIL_OR_PASSWORD' ? 'Email or password is incorrect. Go back and sign in again.' : authError.message);
    } catch (err) {
      setError(err.message || 'Could not resend the code. Please wait a moment and try again.');
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const { error: authError } = await authClient.emailOtp.requestPasswordReset({ email: email.trim().toLowerCase() });
      if (authError) throw new Error(authError.message);
      setVerificationCode('');
      setRecoveryStep('reset');
      setNotice('If this email has an account, a reset code was requested. Email can take a few minutes.');
    } catch (err) {
      setError(err.message || 'Could not request a reset code.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!/^\d{6}$/.test(verificationCode.trim())) { setError('Enter the 6-digit code from your email.'); return; }
    if (newPassword.length < 8) { setError('Use a password of at least 8 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await authClient.emailOtp.resetPassword({ email: email.trim().toLowerCase(), otp: verificationCode.trim(), password: newPassword });
      if (authError) throw new Error(authError.message);
      setRecoveryStep(null);
      setMode('signin');
      setPassword('');
      setNewPassword('');
      setVerificationCode('');
      setNotice('Password updated. Sign in with your new password.');
    } catch (err) {
      setError(err.message || 'Could not reset your password. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError('');
    setNotice('');
    setPendingVerification(false);
    setRecoveryStep(null);
  };

  if (pendingVerification || recoveryStep) {
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
              
              <Text style={styles.title}>{pendingVerification ? 'Verify your email' : 'Reset your password'}</Text>
              <Text style={styles.subtitle}>
                {pendingVerification ? `Enter the 6-digit code requested for ${email}.` : recoveryStep === 'request' ? 'Enter your email and we will send you a reset code.' : `Enter the code sent to ${email}, then choose a new password.`}
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

              {recoveryStep === 'request' && <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="you@example.com" />
              </View>}

              {(pendingVerification || recoveryStep === 'reset') && <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Verification code</Text>
                <TextInput style={styles.input} value={verificationCode} onChangeText={(value) => setVerificationCode(value.replace(/\D/g, ''))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" />
              </View>}

              {recoveryStep === 'reset' && <View style={[styles.inputContainer, { marginTop: 16 }]}>
                <Text style={styles.inputLabel}>New password</Text>
                <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" placeholder="At least 8 characters" />
              </View>}

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={pendingVerification ? handleVerifyEmail : recoveryStep === 'request' ? requestPasswordReset : resetPassword}
                disabled={loading || (pendingVerification && verificationCode.length !== 6) || (recoveryStep === 'reset' && (verificationCode.length !== 6 || newPassword.length < 8))}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>{pendingVerification ? 'Verify email' : recoveryStep === 'request' ? 'Send reset code' : 'Set new password'}</Text>
                )}
              </TouchableOpacity>

              {pendingVerification && <TouchableOpacity onPress={resendVerification} disabled={loading} style={styles.switchModeButton}>
                <Text style={styles.switchModeText}>Resend code or sign in</Text>
              </TouchableOpacity>}
              {recoveryStep === 'reset' && <TouchableOpacity onPress={requestPasswordReset} disabled={loading} style={styles.switchModeButton}>
                <Text style={styles.switchModeText}>Send a new reset code</Text>
              </TouchableOpacity>}

              <TouchableOpacity onPress={() => { setPendingVerification(false); setRecoveryStep(null); setError(''); setNotice(''); }} style={styles.switchModeButton}>
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
            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

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
                  autoComplete="email"
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
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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

              {mode === 'signin' && <TouchableOpacity onPress={() => { setError(''); setNotice(''); setRecoveryStep('request'); }} style={styles.forgotPasswordButton}>
                <Text style={styles.switchModeText}>Forgot password?</Text>
              </TouchableOpacity>}

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
  noticeText: {
    color: '#166534',
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  switchModeText: {
    color: '#489CFC',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
})
