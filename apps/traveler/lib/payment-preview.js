// Mock bookings are device-local test records. Never send them to booking/payment APIs.

// Web checkout is a mock until gateways are connected. Native release builds stay real.
export function isPaymentPreviewEnabled(development, platform) {
  return development === true || platform === 'web';
}

export function isPaymentPreviewId(id) {
  return typeof id === 'string' && id.startsWith('preview-');
}

export function createPaymentPreview({ userId, hotel, room, quote, adults, children }, enabled) {
  if (enabled !== true) throw new Error('Payment previews are not enabled.');
  if (!userId || !hotel?.id || !room?.id || !Number.isFinite(quote?.total_price) || quote.total_price <= 0 || !quote.check_in_date || !quote.check_out_date) {
    throw new Error('Choose a room and valid dates before previewing confirmation.');
  }
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: `preview-${key}`,
    reference: `MOCK-${key.toUpperCase()}`,
    created_at: new Date().toISOString(),
    user_id: userId,
    is_payment_preview: true,
    booking_status: 'mock',
    payment_status: 'not_charged',
    check_in_date: quote.check_in_date,
    check_out_date: quote.check_out_date,
    adults, children, guests: adults + children,
    total_price: quote.total_price,
    nightly_rate: quote.nightly_rate,
    service_fee: quote.service_fee,
    policy: { ...quote.policy },
    hotels: {
      id: hotel.id, name: hotel.name, city: hotel.city || hotel.location,
      address: Array.isArray(hotel.address) ? [...hotel.address] : hotel.address,
      images: [...(hotel.images || [])],
    },
    rooms: { id: room.id, name: room.name, images: [...(room.images || [])] },
  };
}

export function createMockBookingStore(storage) {
  let writes = Promise.resolve();
  const keyFor = (userId) => `@hoysii/mock-bookings/v1/${encodeURIComponent(userId)}`;
  const isOwnedMock = (booking, userId) => booking?.user_id === userId
    && booking.is_payment_preview === true && isPaymentPreviewId(booking.id)
    && booking.booking_status === 'mock' && booking.payment_status === 'not_charged';

  const list = async (userId, enabled) => {
    if (enabled !== true || !userId) return [];
    const raw = await storage.getItem(keyFor(userId));
    if (!raw) return [];
    let rows;
    try { rows = JSON.parse(raw); } catch { throw new Error('Could not read mock bookings saved on this device.'); }
    if (!Array.isArray(rows)) throw new Error('Could not read mock bookings saved on this device.');
    return rows.filter((booking) => isOwnedMock(booking, userId));
  };

  return {
    list,
    async get(id, userId, enabled) {
      return (await list(userId, enabled)).find((booking) => booking.id === id) || null;
    },
    save(booking, enabled) {
      if (enabled !== true || !booking?.user_id || !isOwnedMock(booking, booking.user_id)) {
        return Promise.reject(new Error('Only mock bookings can be saved on this device.'));
      }
      // Serialize read/modify/write so two completed previews cannot erase each other.
      const write = writes.catch(() => {}).then(async () => {
        const rows = await list(booking.user_id, enabled);
        await storage.setItem(keyFor(booking.user_id), JSON.stringify([booking, ...rows.filter((row) => row.id !== booking.id)]));
        return booking;
      });
      writes = write;
      return write;
    },
  };
}
