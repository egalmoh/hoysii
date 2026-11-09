import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Pressable, StyleSheet, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { useWebLayout } from '../lib/use-web-layout';

const POPULAR_PLACES = [
  {
    id: 1,
    name: 'Moqadisho',
    region: 'Banaadir',
    image: require('../assets/destinations/mogadishu.jpg'),
    landmark: 'Liido Beach',
  },
  {
    id: 2,
    name: 'Hargeysa',
    region: 'Togdheer',
    image: require('../assets/destinations/hargeisa.jpg'),
    landmark: 'Hargeisa War Memorial',
  },
  {
    id: 4,
    name: 'Garowe',
    region: 'Nugaal',
    image: require('../assets/destinations/garowe.jpg'),
    landmark: 'Beerta Barako gardens',
  },
  { id: 5, name: 'Bosaso', region: 'Bari', image: require('../assets/destinations/bosaso.jpg'), landmark: 'Bosaso beach at sunset' },
  { id: 6, name: 'Galkacyo', region: 'Mudug', image: require('../assets/destinations/galkacyo.jpg'), landmark: 'Awale Stadium' },
  { id: 7, name: 'Berbera', region: 'Sahil', image: require('../assets/destinations/berbera.jpg'), landmark: 'Berbera beach' },
  { id: 8, name: 'Borama', region: 'Awdal', image: require('../assets/destinations/borama.jpg'), landmark: 'Borama book monument' },
];

export default function SearchModal({
  visible,
  currentStep, // 'location' | 'dates' | 'people'
  onClose,
  onNext,
  searchData,
  allowEmptyLocation = false,
  onUpdateSearchData,
  onCompleteSearch,
  headerHeight,
}) {
  const { wide, width } = useWebLayout();
  const [containerHeight, setContainerHeight] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [selectedDates, setSelectedDates] = useState({ checkIn: null, checkOut: null });
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [markedDates, setMarkedDates] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dateError, setDateError] = useState('');
  const wasVisible = useRef(false);

  useLayoutEffect(() => {
    if (visible && !wasVisible.current) {
      const location = searchData?.location || null;
      const checkIn = searchData?.dates?.checkIn || null;
      const checkOut = searchData?.dates?.checkOut || null;
      setSelectedPlace(location);
      setSearchText(location ? `${location.name}${location.region ? `, ${location.region}` : ''}` : '');
      setSelectedDates({ checkIn, checkOut });
      setMarkedDates(checkIn && checkOut ? Object.fromEntries(getDateRange(checkIn, checkOut).map((date, index, dates) => [date, {
        startingDay: index === 0,
        endingDay: index === dates.length - 1,
        color: index === 0 || index === dates.length - 1 ? '#489CFC' : '#C5E0FE',
        textColor: index === 0 || index === dates.length - 1 ? '#FFFFFF' : '#111827',
      }])) : checkIn ? { [checkIn]: { startingDay: true, endingDay: true, color: '#489CFC', textColor: '#FFFFFF' } } : {});
      setAdults(searchData?.guests?.adults || 1);
      setChildren(searchData?.guests?.children || 0);
      setCalendarMonth(checkIn ? checkIn.slice(0, 7) : new Date().toISOString().slice(0, 7));
      setDateError('');
    }
    wasVisible.current = visible;
  }, [visible, searchData]);
  const calendarMarks = markedDates;

  // Handle date selection for range picking
  const handleDayPress = (day) => {
    const dateString = day.dateString;
    setDateError('');
    
    if (!selectedDates.checkIn || (selectedDates.checkIn && selectedDates.checkOut)) {
      // Start new selection
      setSelectedDates({ checkIn: dateString, checkOut: null });
      setMarkedDates({
        [dateString]: {
          startingDay: true,
          endingDay: true,
          color: '#489CFC',
          textColor: '#FFFFFF',
        },
      });
    } else if (dateString > selectedDates.checkIn) {
      // Set checkout date and mark range
      setSelectedDates({ ...selectedDates, checkOut: dateString });
      
      const range = getDateRange(selectedDates.checkIn, dateString);
      const newMarkedDates = {};
      
      range.forEach((date, index) => {
        const isStart = index === 0;
        const isEnd = index === range.length - 1;
        
        newMarkedDates[date] = {
          startingDay: isStart,
          endingDay: isEnd,
          color: (isStart || isEnd) ? '#489CFC' : '#C5E0FE',
          textColor: (isStart || isEnd) ? '#FFFFFF' : '#111827',
        };
      });
      
      setMarkedDates(newMarkedDates);
    } else {
      // If selected date is before check-in, restart selection
      setSelectedDates({ checkIn: dateString, checkOut: null });
      setMarkedDates({
        [dateString]: {
          startingDay: true,
          endingDay: true,
          color: '#489CFC',
          textColor: '#FFFFFF',
        },
      });
    }
  };

  // Get all dates between start and end
  const getDateRange = (startDate, endDate) => {
    const dates = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };
  
  const translateY = useSharedValue(-50);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    }
  }, [visible, currentStep]);

  const handleClose = () => {
    opacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(-20, { duration: 200 }, () => {
      runOnJS(onClose)();
    });
  };

  const completeSearch = (data) => {
    onUpdateSearchData(data);
    onCompleteSearch?.(data);
    onNext('search');
  };

  const handleNext = () => {
    const manualLocation = searchText.trim()
      ? { name: searchText.split(',')[0].trim(), region: searchText.split(',').slice(1).join(',').trim() }
      : null;
    if (currentStep === 'location') {
      if (selectedPlace || manualLocation || allowEmptyLocation) {
        onUpdateSearchData({
          location: selectedPlace || manualLocation,
        });
        onNext('dates');
      }
    } else if (currentStep === 'dates') {
      if (selectedDates.checkIn && !selectedDates.checkOut) return;
      onUpdateSearchData({ dates: selectedDates });
      onNext('people');
    } else if (currentStep === 'people') {
      const finalData = {
        location: selectedPlace || manualLocation,
        dates: selectedDates.checkIn || selectedDates.checkOut
          ? selectedDates
          : searchData?.dates || { checkIn: null, checkOut: null },
        guests: { adults, children },
      };

      opacity.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(-20, { duration: 200 }, (finished) => {
        if (finished) runOnJS(completeSearch)(finalData);
      });
    }
  };

  const handleSelectPlace = (place) => {
    setSelectedPlace(place);
    setSearchText(`${place.name}, ${place.region}`);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.6,
  }));

  if (!visible) return null;

  // The heading and search stay outside the scrolling step content.
  const renderHeader = () => (
    <View style={[styles.modalHeader, { paddingBottom: currentStep === 'dates' ? 21 : currentStep === 'people' ? 40 : 0 }]}>
      <Text style={styles.title}>
        {currentStep === 'location' ? 'Where do you want to visit?' : currentStep === 'dates' ? 'When do you want to visit?' : 'Who is with you?'}
      </Text>
      {currentStep === 'location' && (
        <>
          <View style={styles.searchInputContainer}>
            <Feather name="search" size={20} color="#6B7280" style={{ marginRight: 12 }} />
            <TextInput
              value={searchText}
              onChangeText={(text) => { setSearchText(text); setSelectedPlace(null); }}
              placeholder="Garowe, Puntland"
              placeholderTextColor="#6B7280"
              style={styles.searchInput}
            />
          </View>
          <Text style={styles.sectionLabel}>Most visited places</Text>
        </>
      )}
    </View>
  );

  const renderLocationContent = () => (
    <View style={{ marginBottom: 16 }}>
      {POPULAR_PLACES.map((place) => (
        <TouchableOpacity
          key={place.id}
          onPress={() => handleSelectPlace(place)}
          style={[
            styles.placeItem,
            selectedPlace?.id === place.id && styles.placeItemSelected
          ]}
        >
          {place.image ? <Image
            source={place.image}
            accessibilityLabel={place.landmark}
            style={styles.placeImage}
            resizeMode="cover"
          /> : <View style={[styles.placeImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF5FE' }]}><Feather name="map-pin" size={24} color="#489CFC" /></View>}
          <Text style={styles.placeName}>
            {place.name}, {place.region}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // Dates Step Content
  const renderDatesContent = () => (
    <View style={{ gap: 21 }}>
      <View style={styles.calendarContainer}>
        <Calendar
          onDayPress={handleDayPress}
          onMonthChange={({ year, month }) => setCalendarMonth(`${year}-${String(month).padStart(2, '0')}`)}
          current={`${calendarMonth}-01`}
          markingType="period"
          markedDates={calendarMarks}
          minDate={new Date().toISOString().split('T')[0]}
          theme={{
            backgroundColor: 'transparent',
            calendarBackground: 'transparent',
            textSectionTitleColor: '#6B7280',
            selectedDayBackgroundColor: '#489CFC',
            selectedDayTextColor: '#FFFFFF',
            todayTextColor: '#489CFC',
            dayTextColor: '#111827',
            textDisabledColor: '#D1D5DB',
            arrowColor: '#6B7280',
            monthTextColor: '#6B7280',
            textDayFontSize: 12,
            textMonthFontSize: 16,   
            textDayHeaderFontSize: 14,
          }}
          renderArrow={(direction) => (
            <View style={styles.calendarArrow}>
              <Feather
                name={direction === 'left' ? 'chevron-left' : 'chevron-right'}
                size={18}
                color="#6B7280"
              />
            </View>
          )}
        />
      </View>
      {dateError ? <Text style={{ color: '#B45309', fontSize: 12 }}>{dateError}</Text> : null}
    </View>
  );

  // People Step Content
  const renderPeopleContent = () => (
    <View style={{ marginBottom: 16 }}>
      <View style={{ gap: 24 }}>
        {/* Adults Row */}
        <View>
          <View style={styles.counterRow}>
            <Text style={styles.counterLabel}>Adults</Text>
            
            <View style={styles.counterControls}>
              <TouchableOpacity
                onPress={() => setAdults(Math.max(1, adults - 1))}
                style={styles.counterButton}
              >
                <Feather name="minus" size={16} color="#6B7280" />
              </TouchableOpacity>
              
              <Text style={styles.counterValue}>{adults}</Text>
              
              <TouchableOpacity
                onPress={() => setAdults(adults + 1)}
                style={styles.counterButton}
              >
                <Feather name="plus" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.divider} />
        </View>

        {/* Children Row */}
        <View>
          <View style={styles.counterRow}>
            <Text style={styles.counterLabel}>Children</Text>
            
            <View style={styles.counterControls}>
              <TouchableOpacity
                onPress={() => setChildren(Math.max(0, children - 1))}
                style={styles.counterButton}
              >
                <Feather name="minus" size={16} color="#6B7280" />
              </TouchableOpacity>
              
              <Text style={styles.counterValue}>{children}</Text>
              
              <TouchableOpacity
                onPress={() => setChildren(children + 1)}
                style={styles.counterButton}
              >
                <Feather name="plus" size={16} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  const getButtonText = () => {
    if (currentStep === 'people') return 'Search';
    return 'Next';
  };

  return (
    <View
      style={styles.container}
      pointerEvents="box-none"
      onLayout={({ nativeEvent }) => setContainerHeight(nativeEvent.layout.height)}
    >
      {/* Backdrop - starts below header */}
      <Animated.View
        style={[styles.backdrop, backdropStyle, { top: headerHeight }]}
        pointerEvents="auto"
      >
        <Pressable style={styles.backdropPressable} onPress={handleClose} />
      </Animated.View>

      {/* Modal Content */}
      <Animated.View style={[styles.modal, animatedStyle, wide && { left: (width - 520) / 2, right: undefined, width: 520 }, {
        top: headerHeight + 8,
        maxHeight: Math.max(0, containerHeight - headerHeight - 20),
        paddingHorizontal: currentStep === 'people' ? 24 : 17,
      }]} pointerEvents="auto">
        {renderHeader()}
        <ScrollView
          key={currentStep}
          testID="search-modal-content"
          style={styles.modalBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalBodyContent}>
          {currentStep === 'location' && renderLocationContent()}
          {currentStep === 'dates' && renderDatesContent()}
          {currentStep === 'people' && renderPeopleContent()}
        </ScrollView>
        {/* Fixed actions remain reachable while the step content scrolls. */}
        <View style={[styles.actionButtons, { paddingTop: currentStep === 'dates' ? 24 : currentStep === 'people' ? 10 : 20 }]}>
          <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNext} disabled={currentStep === 'dates' && !!selectedDates.checkIn && !selectedDates.checkOut} style={[styles.nextButton, currentStep === 'dates' && !!selectedDates.checkIn && !selectedDates.checkOut && { opacity: 0.5 }]}>
            <Text style={styles.nextText}>{getButtonText()}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 20,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#00000050',
  },
  backdropPressable: {
    flex: 1,
  },
  modal: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#F9F9F9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 5,
    zIndex: 100,
    paddingVertical: 15,
  },
  modalHeader: {
    flexShrink: 0,
  },
  modalBody: {
    flexShrink: 1,
    minHeight: 0,
  },
  modalBodyContent: {
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 16,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 0,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  placeItemSelected: {
    backgroundColor: 'rgba(72, 156, 252, 0.1)',
  },
  placeImage: {
    width: 67,
    height: 63,
    borderRadius: 14,
  },
  placeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  calendarContainer: {
    borderRadius: 10,
    margin: 0,
    padding: 0,
  },
  calendarArrow: {
    width: 28,
    height: 28,
    backgroundColor: '#E4E9E8',
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 0,
    padding: 0,
  
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counterButton: {
    width: 24,
    height: 24,
    backgroundColor: '#E4E9E8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    minWidth: 30,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#E4E9E8',
    marginTop: 16,
  },
  actionButtons: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  nextButton: {
    backgroundColor: '#489CFC',
    paddingVertical: 12,
    paddingHorizontal: 39,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
