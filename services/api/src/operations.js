import { all, db, first, run } from './db.js';
import { activity, bookingDetail, bookingRecord, exception, holdExpired, notification, parse, refundQuote, reject, statement, text, today, travelerBooking, validRange } from './booking-service.js';
import { paymentProvider } from './payments.js';
import { sendAuthEmail } from './auth.js';

function requireNote(value) { const note = text(value); if (note.length < 3) reject('Add a reason or supporting note.'); return note; }
function bookingGuard(database, booking, actor, action, note) {
  // A NOT NULL violation rolls back the entire D1 batch if the booking changed
  // after it was read. The caller can refresh instead of applying a stale decision.
  return statement(database, `INSERT INTO booking_activity (id,booking_id,actor,action,note)
    VALUES (?,?,?,?,(SELECT ? FROM bookings WHERE id=? AND booking_status=? AND payment_status=?))`,
  crypto.randomUUID(), booking.id, actor, action, note, booking.id, booking.booking_status, booking.payment_status);
}
function paymentStatements(env, booking, payment, recovery) {
  const database = db(env);
  const id = crypto.randomUUID();
  const snapshot = JSON.stringify({ reference: booking.reference, booking_id: booking.id, hotel: parse(booking.hotel_snapshot), room: parse(booking.room_snapshot),
    check_in_date: booking.check_in_date, check_out_date: booking.check_out_date, adults: booking.adults, children: booking.children,
    nightly_cents: booking.nightly_cents, service_fee_cents: booking.service_fee_cents,
    amount_cents: payment.amount_cents, currency: payment.currency, provider: payment.provider, transaction_reference: payment.reference, source: payment.source });
  const statements = [
    statement(database, "INSERT INTO payments (id,booking_id,provider,reference,amount_cents,currency,source,status,recorded_by,note) VALUES (?,?,?,?,?,?,?,'succeeded',?,?)", id, booking.id, payment.provider, payment.reference, payment.amount_cents, payment.currency, payment.source, payment.actor, payment.note),
    statement(database, `UPDATE bookings SET payment_status='paid', payment_provider=?, transaction_reference=?, paid_at=CURRENT_TIMESTAMP,
      booking_status=CASE WHEN booking_status IN ('cancelled','refunded') THEN booking_status ELSE ? END,
      hotel_ack_status=CASE WHEN booking_status IN ('cancelled','refunded') OR ? THEN 'not_sent' ELSE 'pending' END,
      hotel_ack_due_at=CASE WHEN booking_status IN ('cancelled','refunded') OR ? THEN NULL ELSE datetime('now','+30 minutes') END,
      updated_at=CURRENT_TIMESTAMP WHERE id=?`, payment.provider, payment.reference, recovery ? 'recovery_required' : 'confirmed', Number(recovery), Number(recovery), booking.id),
    statement(database, 'INSERT INTO receipts (id,booking_id,payment_id,snapshot) VALUES (?,?,?,?)', crypto.randomUUID(), booking.id, id, snapshot),
    statement(database, `INSERT INTO refunds (id,booking_id,amount_cents,currency,reason)
      SELECT ?,id,total_cents,currency,'Payment received after cancellation' FROM bookings WHERE id=? AND booking_status='cancelled'
      ON CONFLICT(booking_id) DO NOTHING`, crypto.randomUUID(), booking.id),
    activity(database, booking.id, payment.actor, 'payment_received', `${payment.source} payment ${payment.provider}: ${payment.reference}. ${payment.note}`),
    statement(database, `INSERT INTO notifications (id,booking_id,kind,recipient,subject,body)
      SELECT ?,id,'traveler_receipt',?,?,CASE WHEN booking_status='confirmed' THEN ? ELSE ? END FROM bookings WHERE id=?`,
    crypto.randomUUID(), booking.guest_email, `Hoysii payment receipt: ${booking.reference}`,
    `Booking confirmed: ${booking.reference}. ${parse(booking.hotel_snapshot)?.name || booking.current_hotel_name}, ${booking.check_in_date} to ${booking.check_out_date}. Paid ${payment.currency} ${(payment.amount_cents / 100).toFixed(2)}. Transaction: ${payment.reference}. Contact Hoysii for help.`,
    `Payment received for ${booking.reference}: ${payment.currency} ${(payment.amount_cents / 100).toFixed(2)}. Transaction: ${payment.reference}. Hoysii support is resolving your reservation and will contact you.`, booking.id),
  ];
  if (booking.manager_email) {
    statements.push(statement(database, `INSERT INTO notifications (id,booking_id,kind,recipient,subject,body)
      SELECT ?,id,'hotel_booking',?,?,? FROM bookings WHERE id=? AND booking_status='confirmed'`, crypto.randomUUID(), booking.manager_email,
    `Hoysii reservation ${booking.reference} — acknowledge within 30 minutes`,
    `${booking.reference}: ${booking.guest_name}; ${booking.check_in_date} to ${booking.check_out_date}; ${parse(booking.room_snapshot)?.name || 'room'}; ${booking.guests} guests. Payment received by Hoysii. Please acknowledge this reservation to Hoysii within 30 minutes.`, booking.id));
  } else {
    statements.push(exception(database, booking.id, 'hotel_contact_missing', 'Add a hotel notification email and contact the hotel to acknowledge this reservation.'));
  }
  if (env.ADMIN_EMAIL) statements.push(notification(database, booking.id, 'new_paid_booking', env.ADMIN_EMAIL, `Paid booking: ${booking.reference}`,
    `${booking.reference} has received ${payment.currency} ${(payment.amount_cents / 100).toFixed(2)}. Review hotel acknowledgement and any exceptions in Hoysii admin.`));
  statements.push(statement(database, `INSERT OR IGNORE INTO booking_exceptions (id,booking_id,kind,note)
    SELECT ?,id,'payment_reservation_problem','Payment received but this reservation requires recovery or refund.' FROM bookings
    WHERE id=? AND booking_status IN ('recovery_required','cancelled','refunded')`, crypto.randomUUID(), booking.id));
  return statements;
}

// Only verified adapters or the authenticated manual-payment admin action call this.
// No HTTP endpoint accepts a client-supplied "payment succeeded" assertion.
export async function settlePayment(env, bookingId, input) {
  const database = db(env);
  const booking = await bookingRecord(env, bookingId);
  if (!booking) reject('Booking not found.', 404);
  const payment = { provider: text(input.provider, 50), reference: text(input.reference, 150), amount_cents: input.amount_cents,
    currency: input.currency, source: input.source, actor: input.actor, note: requireNote(input.note) };
  if (!payment.provider || payment.reference.length < 3 || !Number.isSafeInteger(payment.amount_cents) || payment.amount_cents <= 0 || payment.amount_cents !== booking.total_cents || payment.currency !== booking.currency || !['manual', 'provider'].includes(payment.source)) reject('Payment must match the booking amount and currency and include a transaction reference.');
  const previous = await first(database, 'SELECT * FROM payments WHERE provider=? AND reference=?', payment.provider, payment.reference);
  if (previous) {
    if (previous.booking_id !== bookingId || previous.amount_cents !== payment.amount_cents || previous.currency !== payment.currency || previous.status !== 'succeeded') reject('This transaction reference is already in use.', 409);
    return bookingDetail(env, bookingId);
  }
  if (booking.payment_status !== 'pending') reject('This booking already has a recorded payment.', 409);
  if (!booking.policy_snapshot || !booking.hotel_snapshot) reject('This historical booking needs manual reconciliation; it cannot be settled through the new workflow.', 409);
  try {
    await database.batch(paymentStatements(env, booking, payment, booking.check_in_date < today()));
  } catch (error) {
    if (/inventory_conflict/.test(error.message)) {
      await database.batch(paymentStatements(env, booking, payment, true));
    } else {
      const duplicate = await first(database, 'SELECT * FROM payments WHERE provider=? AND reference=?', payment.provider, payment.reference);
      if (duplicate?.booking_id === bookingId && duplicate.amount_cents === payment.amount_cents && duplicate.currency === payment.currency) return bookingDetail(env, bookingId);
      if (/UNIQUE constraint/.test(error.message)) reject('A payment is already recorded for this booking or transaction reference.', 409);
      throw error;
    }
  }
  return bookingDetail(env, bookingId);
}

export async function travelerOperations(request, env, url, user) {
  const match = url.pathname.match(/^\/v1\/bookings\/([^/]+)(?:\/(receipt|payments|cancellation))?$/);
  if (!match) return null;
  const database = db(env);
  const booking = await bookingRecord(env, match[1]);
  if (!booking || booking.user_id !== user.id) reject('Booking not found.', 404);
  if (request.method === 'GET' && match[2] === 'receipt') {
    const receipt = await first(database, 'SELECT id,snapshot,created_at FROM receipts WHERE booking_id=?', booking.id);
    if (!receipt) reject('A payment receipt is not available for this booking.', 404);
    const saved = parse(receipt.snapshot);
    return Response.json({ id: receipt.id, ...saved, created_at: receipt.created_at });
  }
  if (request.method === 'POST' && match[2] === 'payments') {
    if (booking.booking_status !== 'payment_pending' || holdExpired(booking)) reject('This unpaid room hold expired. Start a new booking.', 409);
    return Response.json(await paymentProvider(booking.payment_provider).createPayment({ booking, env }));
  }
  if (request.method === 'POST' && match[2] === 'cancellation') {
    if (['cancelled', 'refunded', 'completed'].includes(booking.booking_status) || booking.check_in_date < today()) reject('Contact Hoysii support to resolve this booking.', 409);
    const body = await request.json();
    const reason = requireNote(body.reason);
    await database.batch([
      statement(database, 'INSERT OR IGNORE INTO cancellation_requests (booking_id,reason,estimated_refund_cents) VALUES (?,?,?)', booking.id, reason, refundQuote(booking)),
      statement(database, "INSERT INTO booking_activity (id,booking_id,actor,action,note) SELECT ?,?,?, 'cancellation_requested',? WHERE changes()>0", crypto.randomUUID(), booking.id, user.id, reason),
      exception(database, booking.id, 'cancellation_requested', 'Review the traveler cancellation request and the saved terms.'),
    ]);
    return Response.json(await first(database, 'SELECT * FROM cancellation_requests WHERE booking_id=?', booking.id));
  }
  if (request.method === 'GET' && !match[2]) {
    const detail = await bookingDetail(env, booking.id);
    const receiptEmail = await first(database, "SELECT status FROM notifications WHERE booking_id=? AND kind='traveler_receipt'", booking.id);
    return Response.json({ ...travelerBooking(booking), receipt_email_status: receiptEmail?.status || null, cancellation: detail.cancellation, refund: detail.refund ? { status: detail.refund.status, amount_cents: detail.refund.amount_cents, currency: detail.refund.currency } : null });
  }
  reject('Not found.', 404);
}

export async function adminOperations(request, env, url, admin) {
  const database = db(env);
  const json = Response.json;
  if (url.pathname === '/v1/admin/operations' && request.method === 'GET') {
    const day = today();
    return json({
      check_ins: await all(database, "SELECT id,reference,hotel_snapshot,room_snapshot,hotel_ack_status,check_in_date,check_out_date FROM bookings WHERE check_in_date=? AND payment_status IN ('paid','partially_refunded') AND booking_status NOT IN ('cancelled','refunded')", day),
      check_outs: await all(database, "SELECT id,reference,hotel_snapshot,room_snapshot,check_in_date,check_out_date FROM bookings WHERE check_out_date=? AND payment_status IN ('paid','partially_refunded') AND booking_status NOT IN ('cancelled','refunded')", day),
      awaiting_acknowledgement: await all(database, "SELECT id,reference,hotel_ack_status,hotel_ack_due_at FROM bookings WHERE hotel_ack_status='pending' AND booking_status NOT IN ('cancelled','refunded') ORDER BY hotel_ack_due_at"),
      exceptions: await all(database, "SELECT e.*,b.reference FROM booking_exceptions e JOIN bookings b ON b.id=e.booking_id WHERE e.status='open' ORDER BY e.created_at"),
      refunds: await all(database, "SELECT r.*,b.reference AS booking_reference FROM refunds r JOIN bookings b ON b.id=r.booking_id WHERE r.status NOT IN ('completed','rejected') ORDER BY r.created_at"),
    });
  }
  const detailMatch = url.pathname.match(/^\/v1\/admin\/bookings\/([^/]+)(?:\/(payment|acknowledgement|notes|cancel|reassign|stay))?$/);
  if (detailMatch) {
    const id = detailMatch[1];
    const action = detailMatch[2];
    const booking = await bookingRecord(env, id);
    if (!booking) reject('Booking not found.', 404);
    if (request.method === 'GET' && !action) return json(await bookingDetail(env, id));
    if (!['POST', 'PATCH'].includes(request.method)) reject('Not found.', 404);
    const body = await request.json();
    if (action === 'payment') return json(await settlePayment(env, id, { ...body, source: 'manual', actor: admin.id }));
    const note = requireNote(body.note || body.reason);
    if (action === 'acknowledgement') {
      if (!['acknowledged', 'declined'].includes(body.status) || booking.booking_status !== 'confirmed') reject('Only a paid confirmed reservation can be acknowledged or declined.', 409);
      await database.batch([
        bookingGuard(database, booking, admin.id, `hotel_${body.status}`, note),
        statement(database, 'UPDATE bookings SET hotel_ack_status=?, hotel_ack_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND booking_status=\'confirmed\'', body.status, id),
        statement(database, "UPDATE booking_exceptions SET status='resolved',resolved_at=CURRENT_TIMESTAMP WHERE booking_id=? AND kind IN ('hotel_ack_overdue','hotel_contact_missing') AND status='open'", id),
        ...(body.status === 'declined' ? [exception(database, id, 'hotel_declined', note)] : []),
      ]);
    } else if (action === 'notes') {
      await database.batch([activity(database, id, admin.id, 'note', note)]);
    } else if (action === 'cancel') {
      if (['cancelled','refunded','completed','checked_in'].includes(booking.booking_status)) reject('This booking cannot be cancelled again.', 409);
      const cancellation = await first(database, 'SELECT estimated_refund_cents FROM cancellation_requests WHERE booking_id=?', id);
      const quote = body.hotel_failure === true ? (booking.payment_status === 'paid' ? booking.total_cents : 0) : cancellation ? cancellation.estimated_refund_cents : refundQuote(booking);
      const amount = body.refund_cents ?? quote;
      if (amount == null || !Number.isSafeInteger(amount) || amount < 0 || amount > booking.total_cents || (booking.payment_status !== 'paid' && amount !== 0)) reject('Specify the refund amount in cents after reviewing the saved cancellation terms.');
      if (quote != null && body.refund_cents != null && amount !== quote) reject('The refund amount must match the saved policy; use hotel failure only for a genuine fulfilment failure.');
      await database.batch([
        bookingGuard(database, booking, admin.id, 'cancelled', `${note} Refund due: ${booking.currency} ${(amount / 100).toFixed(2)}.`),
        statement(database, "UPDATE bookings SET booking_status='cancelled',hotel_ack_due_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND booking_status NOT IN ('cancelled','refunded','completed','checked_in')", id),
        statement(database, "UPDATE cancellation_requests SET status='approved' WHERE booking_id=?", id),
        statement(database, "UPDATE notifications SET status='cancelled' WHERE booking_id=? AND kind='hotel_booking' AND status='pending'", id),
        statement(database, "UPDATE booking_exceptions SET status='resolved',resolved_at=CURRENT_TIMESTAMP WHERE booking_id=? AND status='open'", id),
        ...(amount > 0 ? [statement(database, 'INSERT INTO refunds (id,booking_id,amount_cents,currency,reason) VALUES (?,?,?,?,?)', crypto.randomUUID(), id, amount, booking.currency, note)] : []),
        notification(database, id, 'booking_cancelled', booking.guest_email, `Hoysii cancellation: ${booking.reference}`, `${booking.reference} is cancelled. ${amount > 0 ? `A refund of ${booking.currency} ${(amount / 100).toFixed(2)} is requested and is not yet completed.` : 'No refund is due under the recorded cancellation decision.'} Contact Hoysii for support.`),
        ...(booking.manager_email ? [notification(database, id, 'hotel_cancellation', booking.manager_email, `Cancelled: ${booking.reference}`, `${booking.reference}, ${booking.guest_name}, ${booking.check_in_date} to ${booking.check_out_date} is cancelled. Please release this reservation.`)] : []),
      ]);
    } else if (action === 'reassign') {
      if (!['confirmed','recovery_required'].includes(booking.booking_status) || booking.payment_status !== 'paid') reject('Only a paid reservation awaiting fulfilment can be reassigned.', 409);
      const room = await first(database, 'SELECT * FROM rooms WHERE id=?', body.room_id);
      if (!room || room.capacity_adults < (booking.adults || booking.guests)) reject('Choose a suitable replacement room.');
      const hotel = await first(database, 'SELECT * FROM hotels WHERE id=?', room.hotel_id);
      const hotelSnapshot = { id: hotel.id, name: hotel.name, city: hotel.city, address: parse(hotel.address, []), images: parse(hotel.images, []) };
      const roomSnapshot = { id: room.id, name: room.name, images: parse(room.images, []), price: booking.nightly_cents / 100 };
      await database.batch([
        bookingGuard(database, booking, admin.id, 'reassigned', `${note} Previous stay: ${booking.hotel_snapshot} / ${booking.room_snapshot}. Customer's agreed total and terms preserved.`),
        statement(database, "UPDATE bookings SET hotel_id=?,room_id=?,hotel_snapshot=?,room_snapshot=?,booking_status='confirmed',hotel_ack_status='pending',hotel_ack_at=NULL,hotel_ack_due_at=datetime('now','+30 minutes'),updated_at=CURRENT_TIMESTAMP WHERE id=? AND booking_status IN ('confirmed','recovery_required')", hotel.id, room.id, JSON.stringify(hotelSnapshot), JSON.stringify(roomSnapshot), id),
        statement(database, "UPDATE booking_exceptions SET status='resolved',resolved_at=CURRENT_TIMESTAMP WHERE booking_id=? AND status='open'", id),
        ...(hotel.manager_email ? [statement(database, `INSERT INTO notifications (id,booking_id,kind,recipient,subject,body) VALUES (?,?,'hotel_booking',?,?,?)
          ON CONFLICT(booking_id,kind) DO UPDATE SET recipient=excluded.recipient,body=excluded.body,subject=excluded.subject,status='pending',attempts=0,next_attempt_at=CURRENT_TIMESTAMP,lease_token=NULL,lease_until=NULL`, crypto.randomUUID(), id, hotel.manager_email, `Hoysii replacement reservation: ${booking.reference}`, `${booking.reference}: ${booking.guest_name}, ${booking.check_in_date} to ${booking.check_out_date}, ${room.name}, ${booking.guests} guests. Payment received by Hoysii. Acknowledge within 30 minutes.`)] : [exception(database, id, 'hotel_contact_missing', 'Contact the replacement hotel and record acknowledgement.')]),
        ...(booking.manager_email && booking.hotel_id !== hotel.id ? [notification(database, id, `release_previous_hotel_${crypto.randomUUID()}`, booking.manager_email, `Release reservation: ${booking.reference}`, `${booking.reference}, ${booking.guest_name}, ${booking.check_in_date} to ${booking.check_out_date} has been moved to another hotel. Please release the previous reservation.`)] : []),
        notification(database, id, `reassigned_${crypto.randomUUID()}`, booking.guest_email, `Hoysii stay update: ${booking.reference}`, `Your booking ${booking.reference} now has ${hotel.name}, ${room.name}, ${booking.check_in_date} to ${booking.check_out_date}. Your agreed total and cancellation terms remain the same. Contact Hoysii for help.`),
      ]);
    } else if (action === 'stay') {
      const transitions = { checked_in: 'confirmed', completed: 'checked_in' };
      if (transitions[body.status] !== booking.booking_status || booking.payment_status !== 'paid' || booking.hotel_ack_status !== 'acknowledged') reject('This stay transition requires a paid, acknowledged reservation in the preceding state.', 409);
      const column = body.status === 'checked_in' ? 'checked_in_at' : 'completed_at';
      await database.batch([bookingGuard(database, booking, admin.id, body.status, note), statement(database, `UPDATE bookings SET booking_status=?,${column}=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND booking_status=?`, body.status, id, transitions[body.status])]);
    } else reject('Not found.', 404);
    return json(await bookingDetail(env, id));
  }

  const refundMatch = url.pathname.match(/^\/v1\/admin\/refunds\/([^/]+)$/);
  if (refundMatch && request.method === 'PATCH') {
    const refund = await first(database, 'SELECT * FROM refunds WHERE id=?', refundMatch[1]);
    if (!refund) reject('Refund not found.', 404);
    const body = await request.json();
    const note = requireNote(body.note);
    const allowed = { requested: ['approved'], approved: ['processing','completed','failed'], processing: ['completed','failed'], failed: ['approved'] };
    if (refund.status === 'completed' && body.status === 'completed' && refund.reference === body.reference) return json(refund);
    if (!allowed[refund.status]?.includes(body.status)) reject('Invalid refund transition.', 409);
    const reference = body.status === 'completed' ? text(body.reference, 150) : null;
    if (body.status === 'completed' && reference.length < 3) reject('Record the completed manual refund transaction reference.');
    await database.batch([
      statement(database, "UPDATE refunds SET status=?,reference=COALESCE(?,reference),recorded_by=?,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id=? AND status=?", body.status, reference, admin.id, body.status, refund.id, refund.status),
      statement(database, 'INSERT INTO booking_activity (id,booking_id,actor,action,note) SELECT ?,?,?,?,? WHERE changes()>0', crypto.randomUUID(), refund.booking_id, admin.id, `refund_${body.status}`, `${note}${reference ? ` Transaction: ${reference}` : ''}`),
      statement(database, "UPDATE bookings SET payment_status=CASE WHEN total_cents <= ? THEN 'refunded' ELSE 'partially_refunded' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND EXISTS(SELECT 1 FROM refunds WHERE id=? AND status='completed')", refund.amount_cents, refund.booking_id, refund.id),
    ]);
    if (body.status === 'completed') {
      const booking = await bookingRecord(env, refund.booking_id);
      await database.batch([notification(database, booking.id, 'refund_completed', booking.guest_email, `Hoysii refund completed: ${booking.reference}`, `A manual refund of ${refund.currency} ${(refund.amount_cents / 100).toFixed(2)} has been recorded for ${booking.reference}. Transaction: ${reference}. Contact Hoysii if you need help.`)]);
    }
    return json(await first(database, 'SELECT * FROM refunds WHERE id=?', refund.id));
  }
  const exceptionMatch = url.pathname.match(/^\/v1\/admin\/exceptions\/([^/]+)$/);
  if (exceptionMatch && request.method === 'PATCH') {
    const issue = await first(database, 'SELECT * FROM booking_exceptions WHERE id=?', exceptionMatch[1]);
    if (!issue) reject('Exception not found.', 404);
    const body = await request.json();
    const note = requireNote(body.note);
    if (!['open','resolved'].includes(body.status)) reject('Choose open or resolved.');
    await database.batch([
      statement(database, "UPDATE booking_exceptions SET status=?,owner=?,note=?,resolved_at=CASE WHEN ?='resolved' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?", body.status, text(body.owner, 120) || admin.email, note, body.status, issue.id),
      activity(database, issue.booking_id, admin.id, 'exception_updated', note),
    ]);
    return json({ ok: true });
  }

  const roomMatch = url.pathname.match(/^\/v1\/admin\/rooms\/([^/]+)(?:\/(blocks))?$/);
  if (roomMatch) {
    const room = await first(database, 'SELECT * FROM rooms WHERE id=?', roomMatch[1]);
    if (!room) reject('Room not found.', 404);
    if (roomMatch[2] === 'blocks' && request.method === 'GET') return json(await all(database, 'SELECT * FROM inventory_blocks WHERE room_id=? ORDER BY start_date', room.id));
    if (roomMatch[2] === 'blocks' && request.method === 'POST') {
      const body = await request.json();
      if (!validRange(body.start_date, body.end_date) || !Number.isInteger(Number(body.units)) || Number(body.units) < 1) reject('Choose a valid date range and number of rooms.');
      const reason = requireNote(body.reason);
      const id = crypto.randomUUID();
      await run(database, 'INSERT INTO inventory_blocks (id,room_id,start_date,end_date,units,reason,created_by) VALUES (?,?,?,?,?,?,?)', id, room.id, body.start_date, body.end_date, Number(body.units), reason, admin.id);
      return json({ id }, { status: 201 });
    }
    if (!roomMatch[2] && request.method === 'PATCH') {
      const body = await request.json();
      const name = text(body.name, 120) || room.name;
      const price = Number(body.price ?? room.price_cents / 100);
      const units = Number(body.total_units ?? room.total_units);
      const adults = Number(body.capacity_adults ?? room.capacity_adults);
      if (!Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(Math.round(price * 100)) || !Number.isInteger(units) || units < 1 || units > 10000 || !Number.isInteger(adults) || adults < 1 || adults > 20) reject('Enter a valid price, unit count, and guest capacity.');
      await run(database, 'UPDATE rooms SET name=?,price_cents=?,total_units=?,capacity_adults=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', name, Math.round(price * 100), units, adults, room.id);
      return json({ ok: true });
    }
  }
  const blockMatch = url.pathname.match(/^\/v1\/admin\/inventory-blocks\/([^/]+)$/);
  if (blockMatch && request.method === 'DELETE') {
    const result = await run(database, 'DELETE FROM inventory_blocks WHERE id=?', blockMatch[1]);
    if (!result.meta?.changes) reject('Inventory block not found.', 404);
    return json({ ok: true });
  }
  return null;
}

export async function processJobs(env) {
  const database = db(env);
  await database.batch([
    statement(database, "UPDATE bookings SET booking_status='expired',updated_at=CURRENT_TIMESTAMP WHERE booking_status='payment_pending' AND payment_status='pending' AND datetime(COALESCE(hold_expires_at,datetime(created_at,'+15 minutes')))<=datetime('now')"),
    statement(database, `INSERT OR IGNORE INTO booking_exceptions (id,booking_id,kind,note)
      SELECT lower(hex(randomblob(16))),id,'hotel_ack_overdue','The hotel has not acknowledged within 30 minutes. Arrange recovery or a refund.' FROM bookings
      WHERE hotel_ack_status='pending' AND booking_status='confirmed' AND datetime(hotel_ack_due_at)<=datetime('now')`),
  ]);
  if (env.ADMIN_EMAIL) {
    const issues = await all(database, "SELECT e.id,e.booking_id,e.kind,e.note,b.reference FROM booking_exceptions e JOIN bookings b ON b.id=e.booking_id WHERE e.status='open'");
    if (issues.length) await database.batch(issues.map((issue) => notification(database, issue.booking_id, `exception_${issue.id}`, env.ADMIN_EMAIL, `Hoysii needs attention: ${issue.reference}`, `${issue.reference}: ${issue.kind}. ${issue.note}`)));
  }
  const due = await all(database, "SELECT id FROM notifications WHERE (status='pending' AND datetime(next_attempt_at)<=datetime('now')) OR (status='sending' AND datetime(lease_until)<=datetime('now')) ORDER BY created_at LIMIT 20");
  for (const item of due) {
    const token = crypto.randomUUID();
    const claimed = await run(database, "UPDATE notifications SET status='sending',lease_token=?,lease_until=datetime('now','+5 minutes'),attempts=attempts+1 WHERE id=? AND ((status='pending' AND datetime(next_attempt_at)<=datetime('now')) OR (status='sending' AND datetime(lease_until)<=datetime('now')))", token, item.id);
    if (!claimed.meta?.changes) continue;
    const message = await first(database, 'SELECT * FROM notifications WHERE id=? AND lease_token=?', item.id, token);
    try {
      await sendAuthEmail(env, message.recipient, message.subject, message.body);
      await run(database, "UPDATE notifications SET status='sent',sent_at=CURRENT_TIMESTAMP,last_error=NULL,lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?", item.id, token);
    } catch {
      const failed = message.attempts >= 8;
      await run(database, "UPDATE notifications SET status=?,last_error='Email provider did not accept the notification.',next_attempt_at=datetime('now',?),lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=?", failed ? 'failed' : 'pending', `+${Math.min(60, 2 ** message.attempts)} minutes`, item.id, token);
      if (failed) await database.batch([exception(database, message.booking_id, message.kind.startsWith('exception_') ? 'operations_email_unavailable' : `notification_failed_${message.kind}`, 'Email delivery repeatedly failed. Contact the recipient manually.')]);
    }
  }
}
