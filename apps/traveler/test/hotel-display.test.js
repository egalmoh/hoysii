import test from 'node:test';
import assert from 'node:assert/strict';
import { hotelOffers, isHotelVerified } from '../lib/hotel-display.js';

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
