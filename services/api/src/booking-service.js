import { all, db, first } from './db.js';
import { INSERT_BOOKING_SQL, PAYMENT_HOLD_MINUTES } from './availability.js';

export function reject(message, status = 400) { throw Object.assign(new Error(message), { status }); }
export function parse(value, fallback = null) { try { return typeof value === 'string' ? JSON.parse(value) : value ?? fallback; } catch { return fallback; } }
export function validDate(value) { const stamp = Date.parse(`${value}T00:00:00Z`); return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value; }
export function today() { return new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10); }
export function holdExpired(booking) {
  const raw = booking.hold_expires_at || booking.created_at;
  const stamp = Date.parse(raw.endsWith('Z') ? raw : `${raw.replace(' ', 'T')}Z`);
  return !Number.isFinite(stamp) || stamp + (booking.hold_expires_at ? 0 : PAYMENT_HOLD_MINUTES * 60000) <= Date.now();
}
export function validRange(start, end) {
  try {
    const nights = (Date.parse(end) - Date.parse(start)) / 86400000;
    return validDate(start) && validDate(end) && start >= today() && nights > 0 && nights <= 365 && (Date.parse(start) - Date.parse(today())) / 86400000 <= 365;
  } catch { return false; }
}
export function text(value, max = 1000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function statement(database, sql, ...values) { return database.prepare(sql).bind(...values); }
export function activity(database, bookingId, actor, action, note) {
  return statement(database, 'INSERT INTO booking_activity (id, booking_id, actor, action, note) VALUES (?, ?, ?, ?, ?)', crypto.randomUUID(), bookingId, actor, action, note);
}
export function exception(database, bookingId, kind, note) {
  return statement(database, 'INSERT OR IGNORE INTO booking_exceptions (id, booking_id, kind, note) VALUES (?, ?, ?, ?)', crypto.randomUUID(), bookingId, kind, note);
}
export function notification(database, bookingId, kind, recipient, subject, body) {
  return statement(database, 'INSERT OR IGNORE INTO notifications (id, booking_id, kind, recipient, subject, body) VALUES (?, ?, ?, ?, ?, ?)', crypto.randomUUID(), bookingId, kind, recipient, subject, body);
}

export function policyFor(hotel, checkIn) {
  const hours = hotel.free_cancellation_hours == null ? null : Number(hotel.free_cancellation_hours);
  const time = hotel.check_in_time || '14:00';
  return {
    text: hotel.cancellation_policy || 'Contact Hoysii support for cancellation terms.',
    free_cancellation_hours: hours,
    penalty_percent: Number(hotel.cancellation_penalty_percent ?? 100),
    free_cancellation_until: hours == null ? null : new Date(Date.parse(`${checkIn}T${time}:00+03:00`) - hours * 3600000).toISOString(),
    check_in_time: time, check_out_time: hotel.check_out_time || '12:00', timezone: 'Africa/Mogadishu',
  };
}
export function validatePolicy(body, current = {}) {
  const result = {
    check_in_time: body.check_in_time ?? current.check_in_time ?? '14:00',
    check_out_time: body.check_out_time ?? current.check_out_time ?? '12:00',
    cancellation_policy: body.cancellation_policy ?? current.cancellation_policy ?? 'Contact Hoysii support for cancellation terms.',
    free_cancellation_hours: Object.hasOwn(body, 'free_cancellation_hours') ? body.free_cancellation_hours : current.free_cancellation_hours ?? null,
    cancellation_penalty_percent: Number(body.cancellation_penalty_percent ?? current.cancellation_penalty_percent ?? 100),
  };
  if (![result.check_in_time, result.check_out_time].every((v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v))) reject('Enter valid check-in and check-out times.');
  if (typeof result.cancellation_policy !== 'string' || !result.cancellation_policy.trim() || result.cancellation_policy.length > 2000) reject('Enter the agreed cancellation policy.');
  if (result.free_cancellation_hours === '') result.free_cancellation_hours = null;
  if (result.free_cancellation_hours != null) {
    result.free_cancellation_hours = Number(result.free_cancellation_hours);
    if (!Number.isInteger(result.free_cancellation_hours) || result.free_cancellation_hours < 0 || result.free_cancellation_hours > 8760) reject('Free cancellation hours are invalid.');
  }
  if (!Number.isInteger(result.cancellation_penalty_percent) || result.cancellation_penalty_percent < 0 || result.cancellation_penalty_percent > 100) reject('Cancellation penalty must be between 0 and 100 percent.');
  return result;
}
export function policyUpdate(database, id, policy) {
  return statement(database, 'UPDATE hotels SET check_in_time=?, check_out_time=?, cancellation_policy=?, free_cancellation_hours=?, cancellation_penalty_percent=? WHERE id=?', ...Object.values(policy), id);
}

export async function bookingRecord(env, id) {
  return first(db(env), `SELECT b.*, u.email AS guest_email, COALESCE(p.full_name, u.name) AS guest_name, p.phone_number,
    h.manager_email, h.name AS current_hotel_name FROM bookings b JOIN "user" u ON u.id=b.user_id
    LEFT JOIN profiles p ON p.user_id=u.id JOIN hotels h ON h.id=b.hotel_id WHERE b.id=?`, id);
}

export function travelerBooking(row) {
  const policy = parse(row.policy_snapshot);
  const confirmed = ['paid', 'partially_refunded'].includes(row.payment_status) && !['cancelled', 'refunded'].includes(row.booking_status);
  return {
    id: row.id, reference: row.reference || `HYS-${row.id.replaceAll('-', '').toUpperCase()}`,
    hotel_id: row.hotel_id, room_id: row.room_id,
    check_in_date: row.check_in_date, check_out_date: row.check_out_date,
    adults: row.adults, children: row.children, guests: row.guests,
    total_price: row.total_cents / 100, nightly_rate: row.nightly_cents == null ? null : row.nightly_cents / 100,
    service_fee: (row.service_fee_cents || 0) / 100,
    currency: row.currency || 'USD', payment_status: row.payment_status,
    booking_status: row.booking_status === 'payment_pending' && row.payment_status === 'pending' && holdExpired(row) ? 'expired' : confirmed ? 'confirmed' : row.booking_status,
    payment_provider: row.payment_provider, hold_expires_at: row.hold_expires_at,
    paid_at: row.paid_at, created_at: row.created_at, updated_at: row.updated_at,
    hotels: parse(row.hotel_snapshot), rooms: parse(row.room_snapshot), policy,
    refund: row.refund_status ? { status: row.refund_status, amount_cents: row.refund_amount_cents, currency: row.currency || 'USD' } : null,
  };
}

export async function createBooking(env, user, body, key) {
  const database = db(env);
  if (!body.room_id || !validRange(body.check_in_date, body.check_out_date)) reject('Choose valid stay dates within the next year (maximum 365 nights).');
  const adults = Number(body.adults ?? body.guests ?? 1);
  const children = Number(body.children ?? 0);
  if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0 || adults + children > 20) reject('Guest counts are invalid.');
  if (!key || typeof key !== 'string' || key.length > 100) reject('An idempotency key is required.');
  const previous = await first(database, 'SELECT * FROM bookings WHERE idempotency_key=? AND user_id=?', key, user.id);
  if (previous) {
    if (previous.room_id !== body.room_id || previous.check_in_date !== body.check_in_date || previous.check_out_date !== body.check_out_date || previous.adults !== adults || previous.children !== children) reject('This booking request was already used for a different stay.', 409);
    if (['cancelled', 'expired'].includes(previous.booking_status) || (previous.payment_status === 'pending' && holdExpired(previous))) reject('This unpaid room hold expired. Please try booking again.', 409);
    return travelerBooking(previous);
  }
  const room = await first(database, 'SELECT * FROM rooms WHERE id=?', body.room_id);
  if (!room) reject('Room not found.', 404);
  if (adults > room.capacity_adults) reject('This room cannot accommodate that many adults.');
  const hotel = await first(database, 'SELECT * FROM hotels WHERE id=?', room.hotel_id);
  const nights = (Date.parse(body.check_out_date) - Date.parse(body.check_in_date)) / 86400000;
  const base = room.price_cents * nights;
  const serviceFee = Math.round(base * 0.1); // Matches the existing checkout's 10% fee.
  const total = base + serviceFee;
  if (!Number.isSafeInteger(total) || total <= 0) reject('This room does not have a valid bookable rate.', 409);
  if (body.expected_total_cents != null && body.expected_total_cents !== total) reject('The room price has changed. Review the latest price before booking.', 409);
  const id = crypto.randomUUID();
  const hotelSnapshot = { id: hotel.id, name: hotel.name, city: hotel.city, address: parse(hotel.address, []), images: parse(hotel.images, []) };
  const roomSnapshot = { id: room.id, name: room.name, images: parse(room.images, []), bed_size: room.bed_size, price: room.price_cents / 100 };
  const policy = policyFor(hotel, body.check_in_date);
  if (body.expected_policy && Object.entries(policy).some(([key, value]) => body.expected_policy[key] !== value)) reject('The hotel terms have changed. Review the latest terms before booking.', 409);
  try {
    const result = await database.batch([
      statement(database, INSERT_BOOKING_SQL, body.check_in_date, body.check_out_date, id, user.id, body.check_in_date, body.check_out_date, adults + children, total, text(body.payment_provider, 50) || null, key, room.id),
      statement(database, `UPDATE bookings SET reference=?, nightly_cents=?, service_fee_cents=?, adults=?, children=?, hotel_snapshot=?, room_snapshot=?, policy_snapshot=?, hold_expires_at=datetime('now', '+${PAYMENT_HOLD_MINUTES} minutes') WHERE id=?`, `HYS-${id.replaceAll('-', '').slice(0,12).toUpperCase()}`, room.price_cents, serviceFee, adults, children, JSON.stringify(hotelSnapshot), JSON.stringify(roomSnapshot), JSON.stringify(policy), id),
      statement(database, "INSERT INTO booking_activity (id,booking_id,actor,action,note) SELECT ?,id,?,'created','Temporary room hold created' FROM bookings WHERE id=?", crypto.randomUUID(), user.id, id),
    ]);
    if (!result[0].meta?.changes) reject('This room is no longer available for those dates.', 409);
  } catch (error) {
    const retry = await first(database, 'SELECT * FROM bookings WHERE idempotency_key=? AND user_id=?', key, user.id);
    if (retry) {
      if (retry.room_id !== room.id || retry.check_in_date !== body.check_in_date || retry.check_out_date !== body.check_out_date || retry.adults !== adults || retry.children !== children) reject('This request was already used for a different stay.', 409);
      return travelerBooking(retry);
    }
    if (/inventory_conflict|UNIQUE constraint/i.test(error.message)) reject('This room or booking request is no longer available. Please try again.', 409);
    throw error;
  }
  return travelerBooking(await first(database, 'SELECT * FROM bookings WHERE id=?', id));
}

export function refundQuote(booking, at = Date.now()) {
  if (!['paid', 'partially_refunded'].includes(booking.payment_status)) return 0;
  const policy = parse(booking.policy_snapshot);
  if (!policy || policy.free_cancellation_hours == null) return null;
  if (at <= Date.parse(policy.free_cancellation_until)) return booking.total_cents;
  return Math.max(0, booking.total_cents - Math.round(booking.total_cents * policy.penalty_percent / 100));
}

export async function bookingDetail(env, id) {
  const database = db(env);
  const row = await bookingRecord(env, id);
  if (!row) reject('Booking not found.', 404);
  const cancellation = await first(database, 'SELECT * FROM cancellation_requests WHERE booking_id=?', id);
  return {
    ...travelerBooking(row), internal_status: row.booking_status,
    hotel_ack_status: row.hotel_ack_status, hotel_ack_due_at: row.hotel_ack_due_at, hotel_ack_at: row.hotel_ack_at,
    guest: { name: row.guest_name, email: row.guest_email, phone: row.phone_number },
    activity: await all(database, 'SELECT * FROM booking_activity WHERE booking_id=? ORDER BY created_at,rowid', id),
    exceptions: await all(database, 'SELECT * FROM booking_exceptions WHERE booking_id=? ORDER BY created_at DESC', id),
    payments: await all(database, 'SELECT * FROM payments WHERE booking_id=? ORDER BY created_at DESC', id),
    refund: await first(database, 'SELECT * FROM refunds WHERE booking_id=?', id),
    cancellation,
    notifications: await all(database, 'SELECT id,kind,status,attempts,last_error,sent_at FROM notifications WHERE booking_id=?', id),
    estimated_refund_cents: cancellation ? cancellation.estimated_refund_cents : refundQuote(row),
  };
}
