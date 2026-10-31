import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { INSERT_BOOKING_SQL, citySearchTerms, roomAvailable, unavailableDates } from '../src/availability.js';

test('counts occupied nights rather than every booking touching the stay', () => {
  const room = { id: 'room-1', total_units: 2 };
  const bookings = [
    { room_id: room.id, check_in_date: '2026-12-01', check_out_date: '2026-12-02' },
    { room_id: room.id, check_in_date: '2026-12-03', check_out_date: '2026-12-04' },
  ];
  assert.equal(roomAvailable(room, bookings, '2026-12-01', '2026-12-04'), true);
  bookings.push({ room_id: room.id, check_in_date: '2026-12-01', check_out_date: '2026-12-03' });
  assert.equal(roomAvailable(room, bookings, '2026-12-01', '2026-12-04'), false);
});

test('checkout date is not an occupied night', () => {
  const room = { id: 'room-1', total_units: 1 };
  const bookings = [{ room_id: room.id, check_in_date: '2026-12-01', check_out_date: '2026-12-03' }];
  assert.equal(roomAvailable(room, bookings, '2026-12-03', '2026-12-05'), true);
  assert.deepEqual(unavailableDates([room], bookings, '2026-12-01', '2026-12-04'), ['2026-12-01', '2026-12-02']);
});

test('a destination date is disabled only when every matching room is full', () => {
  const rooms = [{ id: 'a', total_units: 1 }, { id: 'b', total_units: 1 }];
  const bookings = [{ room_id: 'a', check_in_date: '2026-12-01', check_out_date: '2026-12-03' }];
  assert.deepEqual(unavailableDates(rooms, bookings, '2026-12-01', '2026-12-02'), []);
  bookings.push({ room_id: 'b', check_in_date: '2026-12-02', check_out_date: '2026-12-03' });
  assert.deepEqual(unavailableDates(rooms, bookings, '2026-12-01', '2026-12-02'), ['2026-12-02']);
});

test('Somali and English spellings find the same destination inventory', () => {
  assert.deepEqual(citySearchTerms('Moqadisho'), citySearchTerms('Mogadishu'));
  assert.deepEqual(citySearchTerms('Hargeysa'), citySearchTerms('Hargeisa'));
});

test('booking insert enforces per-night capacity and releases expired unpaid holds', () => {
  const database = new DatabaseSync(':memory:');
  database.exec(`CREATE TABLE rooms (id TEXT PRIMARY KEY, hotel_id TEXT, total_units INTEGER);
    CREATE TABLE bookings (id TEXT PRIMARY KEY, user_id TEXT, hotel_id TEXT, room_id TEXT, check_in_date TEXT, check_out_date TEXT, guests INTEGER, total_cents INTEGER, payment_status TEXT, payment_provider TEXT, booking_status TEXT, idempotency_key TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO rooms VALUES ('room-1', 'hotel-1', 1);
    INSERT INTO bookings (id, room_id, check_in_date, check_out_date, payment_status, booking_status, created_at)
      VALUES ('expired-hold', 'room-1', '2026-12-03', '2026-12-04', 'pending', 'payment_pending', datetime('now', '-16 minutes'));
    INSERT INTO bookings (id, room_id, check_in_date, check_out_date, payment_status, booking_status)
      VALUES ('confirmed', 'room-1', '2026-12-04', '2026-12-05', 'paid', 'confirmed');`);
  const insert = (id, start, end) => database.prepare(INSERT_BOOKING_SQL).run(start, end, id, 'user-1', start, end, 1, 10000, null, id, 'room-1').changes;
  assert.equal(insert('new-1', '2026-12-01', '2026-12-04'), 1);
  assert.equal(insert('blocked-1', '2026-12-03', '2026-12-05'), 0);
  assert.equal(insert('checkout-free', '2026-12-05', '2026-12-06'), 1);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM bookings').get().count, 4);
  database.close();
});
