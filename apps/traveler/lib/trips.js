export function groupTrips(bookings, today = new Date()) {
  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);
  const groups = { upcoming: [], past: [], mock: [] };
  for (const booking of bookings) {
    if (booking.is_payment_preview) { groups.mock.push(booking); continue; }
    if (booking.booking_status === 'expired') continue;
    const checkOut = booking.check_out_date ? new Date(`${booking.check_out_date}T12:00:00`) : null;
    const past = (booking.stay_status || booking.booking_status) === 'completed' || (checkOut && checkOut < startOfToday);
    groups[past ? 'past' : 'upcoming'].push(booking);
  }
  return groups;
}
