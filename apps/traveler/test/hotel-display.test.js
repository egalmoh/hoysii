import test from 'node:test';
import assert from 'node:assert/strict';
import { hotelOffers, isHotelVerified, recommendedHotels } from '../lib/hotel-display.js';

test('missing, false and string verification values never claim verification', () => {
  for (const is_verified of [undefined, null, false, 0, 'false', '0', 'true']) {
    assert.equal(isHotelVerified({ is_verified }), false);
  }
  assert.equal(isHotelVerified(null), false);
  assert.equal(isHotelVerified({ is_verified: true }), true);
  assert.equal(isHotelVerified({ is_verified: 1 }), true);
});

test('offers contain only saved amenities and security features, without default claims', () => {
  const offers = hotelOffers({ amenities: ['Free WiFi', 'Restaurant'], security_features: [] });
  assert.deepEqual(offers.map((offer) => offer.label), ['Free WiFi', 'Restaurant']);
  assert.deepEqual(hotelOffers({}), []);
  assert.deepEqual(hotelOffers(null), []);
  assert.deepEqual(hotelOffers({ amenities: 'Gym', security_features: null }), []);
});

test('all saved features survive deduplication, including custom and non-English labels', () => {
  const offers = hotelOffers({ amenities: [' Free Wi-Fi ', '', null, 'free wifi', 'Prayer Room', 'مسبح'], security_features: ['CCTV', 'Security Guard', 'Prayer Room', 'حراسة'] });
  assert.deepEqual(offers.map((offer) => offer.label), ['Free Wi-Fi', 'Prayer Room', 'مسبح', 'CCTV', 'Security Guard', 'حراسة']);
  assert.equal(offers[0].icon, 'wifi');
  assert.equal(offers.find((offer) => offer.label === 'Security Guard').icon, 'shield-check-outline');
});

test('owner selections appear in order without fabricated ratings; existing high-rated recommendations remain', () => {
  const hotels = [
    { id: 'rated', rating: 4.8 },
    { id: 'second', is_recommended: true, recommended_order: 1, rating: null, is_verified: false },
    { id: 'other', rating: 4.2 },
    { id: 'first', is_recommended: true, recommended_order: 0, rating: null },
    { id: 'invalid', is_recommended: 'true', rating: null },
  ];
  assert.deepEqual(recommendedHotels(hotels).map(hotel => hotel.id), ['first', 'second', 'rated']);
  assert.deepEqual(hotels.map(hotel => hotel.id), ['rated', 'second', 'other', 'first', 'invalid']);
  assert.equal(hotels[1].rating, null);
  assert.equal(hotels[1].is_verified, false);
});
