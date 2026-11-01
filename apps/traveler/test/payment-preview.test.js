import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentPreview, getPaymentPreview, clearPaymentPreview, isPaymentPreviewId, isPaymentPreviewEnabled } from '../lib/payment-preview.js';

const input = () => ({
  userId: 'traveler', hotel: { id: 'actual-hotel', name: 'Selected hotel', city: 'Garowe', address: ['Saved address'], images: ['saved-photo.jpg'] },
  room: { id: 'actual-room', name: 'Selected room', images: ['saved-room.jpg'] },
  quote: { check_in_date: '2026-12-10', check_out_date: '2026-12-13', total_price: 198, policy: { text: 'Saved terms' } }, adults: 2, children: 1,
});

test('preview uses the selected hotel, room and quote without claiming a real payment or reservation', () => {
  const selected = input();
  const preview = createPaymentPreview(selected, true);
  try {
    selected.hotel.address[0] = 'Later edit';
    assert.equal(preview.hotels.name, 'Selected hotel');
    assert.equal(preview.hotels.address[0], 'Saved address');
    assert.equal(preview.rooms.id, 'actual-room');
    assert.equal(preview.total_price, 198);
    assert.equal(preview.guests, 3);
    assert.equal(preview.payment_status, 'not_charged');
    assert.equal(preview.booking_status, 'preview');
    assert.equal(isPaymentPreviewId(preview.id), true);
    assert.match(preview.reference, /^PREVIEW-/);
    assert.equal(getPaymentPreview(preview.id, 'traveler', true), preview);
    assert.equal(getPaymentPreview(preview.id, 'another-traveler', true), null);
    assert.equal(getPaymentPreview(preview.id, 'traveler', false), null);
  } finally { clearPaymentPreview(preview.id); }
});

test('native releases cannot create previews, and missing prices are not fabricated', () => {
  assert.throws(() => createPaymentPreview(input(), false), /not enabled/);
  assert.throws(() => createPaymentPreview({ ...input(), quote: null }, true), /valid dates/);
  assert.throws(() => createPaymentPreview({ ...input(), userId: '' }, true), /valid dates/);
});

test('published web checkout can preview confirmation with development disabled', () => {
  const webEnabled = isPaymentPreviewEnabled(false, 'web');
  assert.equal(webEnabled, true);
  for (const platform of ['ios', 'android']) {
    assert.equal(isPaymentPreviewEnabled(false, platform), false);
    assert.equal(isPaymentPreviewEnabled(true, platform), true);
  }
  const preview = createPaymentPreview(input(), webEnabled);
  try {
    assert.equal(getPaymentPreview(preview.id, 'traveler', isPaymentPreviewEnabled(false, 'web')), preview);
    assert.equal(preview.payment_status, 'not_charged');
  } finally { clearPaymentPreview(preview.id); }
});

test('only the current transient preview exists and leaving confirmation clears it', () => {
  const first = createPaymentPreview(input(), true);
  const next = createPaymentPreview(input(), true);
  assert.equal(getPaymentPreview(first.id, 'traveler', true), null);
  clearPaymentPreview(first.id);
  assert.equal(getPaymentPreview(next.id, 'traveler', true), next);
  clearPaymentPreview(next.id);
  assert.equal(getPaymentPreview(next.id, 'traveler', true), null);
});
