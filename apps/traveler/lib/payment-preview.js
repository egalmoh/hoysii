// One transient screen preview, not a booking store. Never persisted or sent to the API.
let currentPreview = null;

export function isPaymentPreviewId(id) {
  return typeof id === 'string' && id.startsWith('preview-');
}

export function createPaymentPreview({ userId, hotel, room, quote, adults, children }, development) {
  if (development !== true) throw new Error('Payment previews are only available in development.');
  if (!userId || !hotel?.id || !room?.id || !Number.isFinite(quote?.total_price) || quote.total_price <= 0 || !quote.check_in_date || !quote.check_out_date) {
    throw new Error('Choose a room and valid dates before previewing confirmation.');
  }
  const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  currentPreview = {
    id: `preview-${key}`,
    reference: `PREVIEW-${key.toUpperCase()}`,
    user_id: userId,
    is_payment_preview: true,
    booking_status: 'preview',
    payment_status: 'not_charged',
    check_in_date: quote.check_in_date,
    check_out_date: quote.check_out_date,
    adults, children, guests: adults + children,
    total_price: quote.total_price,
    policy: { ...quote.policy },
    hotels: {
      id: hotel.id, name: hotel.name, city: hotel.city || hotel.location,
      address: Array.isArray(hotel.address) ? [...hotel.address] : hotel.address,
      images: [...(hotel.images || [])],
    },
    rooms: { id: room.id, name: room.name, images: [...(room.images || [])] },
  };
  return currentPreview;
}

export function getPaymentPreview(id, userId, development) {
  return development === true && userId && currentPreview?.id === id && currentPreview.user_id === userId
    ? currentPreview : null;
}

export function clearPaymentPreview(id) {
  if (currentPreview?.id === id) currentPreview = null;
}
