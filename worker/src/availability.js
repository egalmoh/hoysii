export const PAYMENT_HOLD_MINUTES = 15;
const CITY_ALIASES = {
  moqadisho: ['Moqadisho', 'Mogadishu', 'Muqdisho'],
  mogadishu: ['Moqadisho', 'Mogadishu', 'Muqdisho'],
  muqdisho: ['Moqadisho', 'Mogadishu', 'Muqdisho'],
  hargeysa: ['Hargeysa', 'Hargeisa'],
  hargeisa: ['Hargeysa', 'Hargeisa'],
};

export function citySearchTerms(city) {
  return CITY_ALIASES[city.trim().toLowerCase()] || [city];
}
export const ACTIVE_BOOKING_FILTER = `b.booking_status NOT IN ('cancelled', 'refunded', 'expired') AND b.payment_status != 'refunded' AND (b.booking_status != 'payment_pending' OR b.payment_status != 'pending' OR b.created_at > datetime('now', '-${PAYMENT_HOLD_MINUTES} minutes'))`;

export const INSERT_BOOKING_SQL = `WITH RECURSIVE nights(day) AS (
  SELECT ?
  UNION ALL
  SELECT date(day, '+1 day') FROM nights WHERE day < date(?, '-1 day')
)
INSERT INTO bookings (id, user_id, hotel_id, room_id, check_in_date, check_out_date, guests, total_cents, payment_status, payment_provider, booking_status, idempotency_key)
SELECT ?, ?, r.hotel_id, r.id, ?, ?, ?, ?, 'pending', ?, 'payment_pending', ?
FROM rooms r
WHERE r.id = ? AND NOT EXISTS (
  SELECT 1 FROM nights n WHERE (
    SELECT COUNT(*) FROM bookings b
    WHERE b.room_id = r.id AND b.check_in_date <= n.day AND b.check_out_date > n.day AND ${ACTIVE_BOOKING_FILTER}
  ) >= r.total_units
)`;

export function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn, checkOut) {
  const nights = [];
  for (let day = checkIn; day < checkOut; day = addDays(day, 1)) nights.push(day);
  return nights;
}

export function roomAvailable(room, bookings, checkIn, checkOut) {
  const capacity = Number(room.total_units);
  if (!Number.isInteger(capacity) || capacity < 1) return false;
  return nightsBetween(checkIn, checkOut).every((day) =>
    bookings.filter((booking) => booking.room_id === room.id && booking.check_in_date <= day && booking.check_out_date > day).length < capacity
  );
}

export function unavailableDates(rooms, bookings, from, to) {
  const result = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const nextDay = addDays(day, 1);
    if (!rooms.some((room) => roomAvailable(room, bookings, day, nextDay))) result.push(day);
  }
  return result;
}
