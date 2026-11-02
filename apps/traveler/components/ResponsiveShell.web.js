import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { useWebLayout } from '../lib/use-web-layout';
import SearchModal from './SearchModal';

function dateLabel(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ResponsiveShell({ children }) {
  const { wide, width, contentWidth } = useWebLayout();
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const { isSignedIn } = useAuth();
  const [headerHeight, setHeaderHeight] = useState(112);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(null);
  const [search, setSearch] = useState({ location: null, dates: null, guests: null });

  useEffect(() => {
    if (!wide) { setVisible(false); setStep(null); }
  }, [wide]);

  useEffect(() => {
    if (pathname !== '/searchresults') return;
    setSearch({
      location: typeof params.locationName === 'string' && params.locationName ? { name: params.locationName } : null,
      dates: { checkIn: dateLabel(params.checkIn) ? params.checkIn : null, checkOut: dateLabel(params.checkOut) ? params.checkOut : null },
      guests: { adults: Number(params.adults) || 1, children: Number(params.children) || 0 },
    });
  }, [pathname, params.locationName, params.checkIn, params.checkOut, params.adults, params.children]);

  const close = () => { setVisible(false); setStep(null); };
  const submit = (data = search) => {
    close();
    router.navigate({ pathname: '/searchresults', params: {
      locationName: data.location?.name || '', checkIn: data.dates?.checkIn || '', checkOut: data.dates?.checkOut || '',
      adults: String(data.guests?.adults || 1), children: String(data.guests?.children || 0),
    } });
  };
  const open = (nextStep) => { setStep(nextStep); setVisible(true); };
  const dates = search.dates?.checkIn && search.dates?.checkOut
    ? `${dateLabel(search.dates.checkIn)} – ${search.dates.checkIn.slice(0, 7) === search.dates.checkOut.slice(0, 7) ? Number(search.dates.checkOut.slice(-2)) : dateLabel(search.dates.checkOut)}` : 'Add dates';
  const guests = (search.guests?.adults || 0) + (search.guests?.children || 0);

  return (
    <View style={styles.shell}>
      {wide && <View style={styles.header} onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}>
        <View style={[styles.headerInner, { maxWidth: contentWidth }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Hoysii home" onPress={() => { close(); router.navigate('/(tabs)'); }} style={styles.brand}>
            <Image source={require('../assets/Images/hoysii-icon.png')} resizeMode="contain" style={styles.brandMark} />
            {width >= 1200 && <Image source={require('../assets/Images/hoysii-wordmark.png')} accessible={false} resizeMode="contain" style={styles.brandName} />}
          </TouchableOpacity>
          <View style={styles.searchColumn}>
          <View style={styles.searchBar}>
            {[
              ['location', 'Where', search.location?.name || 'Search destinations'],
              ['dates', 'When', dates],
              ['people', 'Who', guests ? `${guests} guest${guests === 1 ? '' : 's'}` : 'Add guests'],
            ].map(([key, label, value], index) => <View key={key} style={[styles.segmentWrap, key === 'location' && { flex: 1.25 }]}>
              {index > 0 && <View style={styles.segmentDivider} />}
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => open(key)} style={[styles.segment, visible && step === key && styles.segmentActive]}>
                <Text style={styles.segmentLabel}>{label}</Text>
                <Text style={styles.segmentValue} numberOfLines={1}>{value}</Text>
              </TouchableOpacity>
            </View>)}
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Search hotels" disabled={visible} onPress={() => submit()} style={[styles.searchButton, visible && { opacity: 0.5 }]}>
              <Feather name="search" size={23} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {pathname === '/' && !visible && <View style={styles.badges}>
            {[
              ['shield-check', 'Physically Verified'],
              ['lock', 'High Security'],
              ['checkbox-marked-circle', 'Safe Booking'],
            ].map(([icon, label]) => <View key={icon} style={styles.badge}>
              <MaterialCommunityIcons name={icon} size={16} color="#489CFC" />
              <Text style={styles.badgeText} numberOfLines={1}>{label}</Text>
            </View>)}
          </View>}
          </View>
          <View style={styles.navigation}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Your trips" onPress={() => { close(); router.navigate('/(tabs)/trips'); }} style={[styles.navButton, pathname === '/trips' && styles.navActive]}>
              <Feather name="briefcase" size={21} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={isSignedIn ? 'Your profile' : 'Log in or sign up'} onPress={() => { close(); router.navigate('/(tabs)/profile'); }} style={[styles.navButton, pathname === '/profile' && styles.navActive]}>
              <Feather name="user" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>
      </View>}
      <View style={styles.body}>{children}</View>
      {wide && <SearchModal visible={visible} currentStep={step} headerHeight={headerHeight} searchData={search} allowEmptyLocation
        onClose={close} onUpdateSearchData={patch => setSearch(current => ({ ...current, ...patch }))}
        onNext={next => next === 'search' ? close() : setStep(next)} onCompleteSearch={data => { setSearch(data); submit(data); }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: 0, backgroundColor: '#FFFFFF' },
  body: { flex: 1, minHeight: 0 },
  header: { paddingVertical: 22, alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E9EAEC', zIndex: 100 },
  headerInner: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  brand: { height: 72, flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  brandMark: { width: 44, height: 38 },
  brandName: { width: 100, height: 38 },
  searchColumn: { flex: 1, maxWidth: 880, minWidth: 0, marginHorizontal: 'auto' },
  searchBar: { width: '100%', height: 72, borderRadius: 40, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDFE2', flexDirection: 'row', alignItems: 'center', padding: 7, shadowColor: '#111827', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 16 },
  badges: { flexDirection: 'row', gap: 10, marginTop: 18 },
  badge: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 20, borderWidth: 0.5, borderColor: '#489CFC', backgroundColor: 'rgba(72,156,252,0.1)' },
  badgeText: { flexShrink: 1, fontFamily: 'Inter_500Medium', fontSize: 11, color: '#111827', textTransform: 'uppercase' },
  segmentWrap: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  segment: { flex: 1, minWidth: 0, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 32, gap: 4 },
  segmentActive: { backgroundColor: '#EDF5FE' },
  segmentLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: '#111827' },
  segmentValue: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#6B7280' },
  segmentDivider: { width: 1, height: 32, backgroundColor: '#E2E3E6' },
  searchButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#489CFC', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  navigation: { height: 72, flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  navButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F7F8' },
  navActive: { backgroundColor: '#E1EEFE' },
});
