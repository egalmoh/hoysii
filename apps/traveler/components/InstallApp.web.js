import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function InstallApp() {
  const [state, setState] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const update = () => setState(window.hoysiiPwa?.getState() || null);
    window.addEventListener('hoysii:pwa-change', update);
    update();
    return () => window.removeEventListener('hoysii:pwa-change', update);
  }, []);

  if (!state?.supported || state.installed) return null;

  const install = async () => {
    if (!state.canPrompt) {
      setShowHelp(true);
      return;
    }
    const result = await window.hoysiiPwa.install();
    if (result === 'unavailable') setShowHelp(true);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Install Hoysii" disabled={state.busy} onPress={install} style={styles.row} activeOpacity={0.7}>
        <View style={styles.label}><Feather name="download" size={20} color="#374151" /><Text style={styles.rowText}>{state.busy ? 'Opening install…' : 'Install Hoysii'}</Text></View>
        <Feather name="chevron-right" size={20} color="#9CA3AF" />
      </TouchableOpacity>
      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowHelp(false)} accessibilityRole="button" accessibilityLabel="Close install instructions" />
          <View style={styles.sheet} accessibilityViewIsModal>
            <ScrollView contentContainerStyle={styles.content}>
              <Text accessibilityRole="header" style={styles.title}>Add Hoysii to your home screen</Text>
              <Text style={styles.description}>Open Hoysii from your phone’s home screen for quick access to hotels and your trips.</Text>
              {state.isIOS ? (
                <>
                  <Text style={styles.step}>1. Tap Share in your browser.</Text>
                  <Text style={styles.step}>2. Choose Add to Home Screen. You may need to scroll down to find it.</Text>
                  <Text style={styles.step}>3. Tap Add.</Text>
                  <Text style={styles.hint}>If you don’t see that option, open hoysii.com in Safari and try again.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.step}>1. Open your browser’s menu.</Text>
                  <Text style={styles.step}>2. Choose Install app or Add to Home screen.</Text>
                  <Text style={styles.step}>3. Confirm to add Hoysii.</Text>
                  <Text style={styles.hint}>On a computer, look for the install icon in the address bar. If installation isn’t available, you can keep using Hoysii in your browser.</Text>
                </>
              )}
              <Text style={styles.hint}>An internet connection is needed to search and manage bookings.</Text>
              <TouchableOpacity accessibilityRole="button" onPress={() => setShowHelp(false)} style={styles.done}><Text style={styles.doneText}>Got it</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF' },
  label: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  rowText: { fontFamily: 'Inter_400Regular', fontSize: 16, color: '#374151', flexShrink: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 420, maxHeight: '90%', backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden' },
  content: { padding: 24, gap: 16 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 29, color: '#111827' },
  description: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, color: '#6B7280' },
  step: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, color: '#111827' },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: '#6B7280' },
  done: { padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#489CFC' },
  doneText: { fontFamily: 'Inter_500Medium', fontSize: 16, color: '#FFFFFF' },
});
