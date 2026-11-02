import test from 'node:test';
import assert from 'node:assert/strict';
import { groupTrips } from '../lib/trips.js';

test('Trips retains past/completed stays and keeps checkout today among upcoming stays', () => {
  const groups = groupTrips([
    { id: 'past', check_out_date: '2026-11-01', booking_status: 'confirmed' },
    { id: 'today', check_out_date: '2026-11-02', booking_status: 'confirmed' },
    { id: 'future', check_out_date: '2026-11-10', booking_status: 'confirmed' },
    { id: 'completed', check_out_date: '2026-11-10', booking_status: 'confirmed', stay_status: 'completed' },
    { id: 'expired', check_out_date: '2026-11-10', booking_status: 'expired' },
  ], new Date(2026, 10, 2, 17));
  assert.deepEqual(groups.upcoming.map((booking) => booking.id), ['today', 'future']);
  assert.deepEqual(groups.past.map((booking) => booking.id), ['past', 'completed']);
});

test('mock bookings never enter either real stay section, regardless of their dates', () => {
  const rows = ['2026-10-01', '2026-12-01'].map((date, index) => ({ id: `preview-${index}`, is_payment_preview: true, booking_status: 'mock', payment_status: 'not_charged', check_out_date: date }));
  const groups = groupTrips(rows, new Date(2026, 10, 2));
  assert.deepEqual(groups.mock, rows);
  assert.deepEqual(groups.upcoming, []);
  assert.deepEqual(groups.past, []);
});
