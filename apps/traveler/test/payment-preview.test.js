import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentPreview, createMockBookingStore, isPaymentPreviewId, isPaymentPreviewEnabled } from '../lib/payment-preview.js';

const input = () => ({
  userId: 'traveler', hotel: { id: 'actual-hotel', name: 'Selected hotel', city: 'Garowe', address: ['Saved address'], images: ['saved-photo.jpg'] },
  room: { id: 'actual-room', name: 'Selected room', images: ['saved-room.jpg'] },
  quote: { check_in_date: '2026-12-10', check_out_date: '2026-12-13', total_price: 198, nightly_rate: 60, service_fee: 18, policy: { text: 'Saved terms' } }, adults: 2, children: 1,
});
const memoryStorage = () => {
  const values = new Map();
  return { values, async getItem(key) { return values.get(key) ?? null; }, async setItem(key, value) { values.set(key, value); } };
};

test('mock uses the chosen hotel and quote without claiming a real payment or reservation', () => {
  const selected = input();
  const preview = createPaymentPreview(selected, true);
  selected.hotel.address[0] = 'Later edit';
  assert.equal(preview.hotels.name, 'Selected hotel');
  assert.equal(preview.hotels.address[0], 'Saved address');
  assert.equal(preview.rooms.id, 'actual-room');
  assert.equal(preview.total_price, 198);
  assert.equal(preview.service_fee, 18);
  assert.equal(preview.guests, 3);
  assert.equal(preview.payment_status, 'not_charged');
  assert.equal(preview.booking_status, 'mock');
  assert.equal(isPaymentPreviewId(preview.id), true);
  assert.match(preview.reference, /^MOCK-/);
  assert.ok(preview.created_at);
});

test('mock persists across app restarts and remains isolated by traveler account', async () => {
  const storage = memoryStorage();
  const preview = createPaymentPreview(input(), true);
  await createMockBookingStore(storage).save(preview, true);
  const restarted = createMockBookingStore(storage);
  assert.deepEqual(await restarted.get(preview.id, 'traveler', true), preview);
  assert.deepEqual(await restarted.list('another-traveler', true), []);
  assert.equal(await restarted.get(preview.id, 'another-traveler', true), null);
  assert.deepEqual(await restarted.list(null, true), []);
});

test('multiple completed mock checkouts survive, and retrying a save does not duplicate a Trip', async () => {
  const store = createMockBookingStore(memoryStorage());
  const first = createPaymentPreview(input(), true);
  const next = createPaymentPreview(input(), true);
  await Promise.all([store.save(first, true), store.save(next, true)]);
  await store.save(first, true);
  const rows = await store.list('traveler', true);
  assert.equal(rows.length, 2);
  assert.deepEqual(new Set(rows.map((row) => row.id)), new Set([first.id, next.id]));
});

test('native releases cannot create, save or read mocks; published web retains mock checkout', async () => {
  const store = createMockBookingStore(memoryStorage());
  const preview = createPaymentPreview(input(), true);
  await store.save(preview, true);
  assert.throws(() => createPaymentPreview(input(), false), /not enabled/);
  await assert.rejects(store.save(preview, false), /Only mock/);
  assert.deepEqual(await store.list('traveler', false), []);
  assert.equal(await store.get(preview.id, 'traveler', false), null);
  assert.equal(isPaymentPreviewEnabled(false, 'web'), true);
  for (const platform of ['ios', 'android']) {
    assert.equal(isPaymentPreviewEnabled(false, platform), false);
    assert.equal(isPaymentPreviewEnabled(true, platform), true);
  }
});

test('missing prices and real or charged records cannot become local mock Trips', async () => {
  assert.throws(() => createPaymentPreview({ ...input(), quote: null }, true), /valid dates/);
  assert.throws(() => createPaymentPreview({ ...input(), userId: '' }, true), /valid dates/);
  const store = createMockBookingStore(memoryStorage());
  const preview = createPaymentPreview(input(), true);
  await assert.rejects(store.save({ ...preview, payment_status: 'paid' }, true), /Only mock/);
  await assert.rejects(store.save({ ...preview, is_payment_preview: false }, true), /Only mock/);
  await assert.rejects(store.save({ ...preview, id: 'real-booking' }, true), /Only mock/);
  assert.deepEqual(await store.list('traveler', true), []);
});

test('malformed saved data is reported without overwriting existing storage', async () => {
  const storage = memoryStorage();
  const store = createMockBookingStore(storage);
  const preview = createPaymentPreview(input(), true);
  await store.save(preview, true);
  const key = [...storage.values.keys()][0];
  storage.values.set(key, 'corrupted data');
  await assert.rejects(store.list('traveler', true), /Could not read/);
  await assert.rejects(store.save(preview, true), /Could not read/);
  assert.equal(storage.values.get(key), 'corrupted data');
});
