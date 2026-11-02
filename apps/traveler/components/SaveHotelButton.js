import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiFetch } from '../lib/api';
import { useAuth } from '../lib/auth';

// Cards on the same screen share a request and reflect each other's changes.
let pendingRequest = null;
const listeners = new Set();
const saving = new Set();
const revisions = new Map();
function loadSavedHotels(userId) {
  if (pendingRequest?.userId === userId) return pendingRequest.promise;
  const promise = apiFetch('/v1/me/saved-hotels').finally(() => {
    if (pendingRequest?.promise === promise) pendingRequest = null;
  });
  pendingRequest = { userId, promise };
  return promise;
}

export default function SaveHotelButton({ hotelId, style }) {
  const { isSignedIn, userId } = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSaved(false);
    setLoaded(false);
    setError('');
    const update = (change) => {
      if (change.userId !== userId || change.hotelId !== hotelId) return;
      setBusy(change.busy);
      if (typeof change.saved === 'boolean') {
        setSaved(change.saved);
        setLoaded(true);
      }
    };
    listeners.add(update);
    return () => listeners.delete(update);
  }, [userId, hotelId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    const key = `${userId}:${hotelId}`;
    const revision = revisions.get(key);
    if (isSignedIn) loadSavedHotels(userId).then((rows) => {
      if (active && !saving.has(key) && revisions.get(key) === revision) {
        setSaved(rows.some((hotel) => hotel.id === hotelId));
        setLoaded(true);
        setError('');
      }
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [hotelId, userId, isSignedIn]));

  const toggle = async (event) => {
    event.stopPropagation();
    if (!isSignedIn) { router.push('/(modals)/login'); return; }
    const key = `${userId}:${hotelId}`;
    if (saving.has(key)) return;
    const publish = (change) => listeners.forEach((listener) => listener({ userId, hotelId, ...change }));
    saving.add(key);
    revisions.set(key, (revisions.get(key) || 0) + 1);
    publish({ busy: true });
    setError('');
    try {
      const wasSaved = loaded ? saved : (await loadSavedHotels(userId)).some((hotel) => hotel.id === hotelId);
      await apiFetch(`/v1/me/saved-hotels/${encodeURIComponent(hotelId)}`, { method: wasSaved ? 'DELETE' : 'POST' });
      publish({ saved: !wasSaved, busy: false });
    } catch (e) {
      setError(e.message);
    } finally {
      saving.delete(key);
      publish({ busy: false });
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove saved hotel' : 'Save hotel'}
        accessibilityState={{ selected: saved, busy }}
        disabled={busy}
        activeOpacity={0.8}
        onPress={toggle}
        style={styles.button}
      >
        {busy ? <ActivityIndicator size="small" color="rgb(250, 250, 250)" /> : <MaterialCommunityIcons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? '#F43F5E' : 'rgb(250, 250, 250)'} />}
      </TouchableOpacity>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 16, right: 16, zIndex: 11 },
  button: { width: 32, height: 32, borderRadius: 32, backgroundColor: 'rgba(115, 115, 115, 0.38)', alignItems: 'center', justifyContent: 'center' },
  error: { position: 'absolute', top: 48, right: 0, width: 160, padding: 8, borderRadius: 8, backgroundColor: '#FFFFFF', color: '#B42318', fontSize: 12, fontFamily: 'Inter_400Regular' },
});
