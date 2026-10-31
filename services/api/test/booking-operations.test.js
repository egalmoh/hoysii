import test from 'node:test';
import assert from 'node:assert/strict';
import { localD1 } from './support/d1.js';
import { createBooking, bookingRecord, travelerBooking, refundQuote } from '../src/booking-service.js';
import { adminOperations, processJobs, settlePayment, travelerOperations } from '../src/operations.js';
import { createAuth, createAdminAuth } from '../src/auth.js';
import worker from '../src/index.js';

const admin = { id: 'operator', email: 'admin@example.com' };
function dates() {
  const start = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.parse(start) + 3 * 86400000).toISOString().slice(0, 10);
  return { check_in_date: start, check_out_date: end };
}
async function fixture() {
  const DB = localD1();
  const sent = [];
  const env = { DB, BETTER_AUTH_URL: 'https://api.hoysii.com', BETTER_AUTH_SECRET: 'traveler-test-secret-at-least-thirty-two-characters', ADMIN_AUTH_SECRET: 'independent-admin-test-secret-at-least-thirty-two-characters', ADMIN_EMAIL: admin.email, TRUSTED_ORIGINS: 'hoysii://,https://admin.hoysii.com', SEND_EMAIL: { async send(message) { sent.push(message); } } };
  await DB.exec(`INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt) VALUES ('traveler','Traveler','traveler@example.com',1,1,1),('other','Other','other@example.com',1,1,1);
    INSERT INTO hotels (id,name,city,manager_email,images,free_cancellation_hours,cancellation_penalty_percent,cancellation_policy)
      VALUES ('hotel','Hotel One','Mogadishu','hotel@example.com','["https://example.com/hotel.jpg"]',24,25,'Free until 24 hours before check-in; then 25 percent penalty.'),
      ('replacement','Hotel Two','Mogadishu','replacement@example.com','[]',48,100,'Different policy');
    INSERT INTO rooms (id,hotel_id,name,price_cents,total_units,capacity_adults) VALUES ('room','hotel','Double',6050,1,2),('replacement-room','replacement','Suite',9000,1,4);`);
  const user = { id: 'traveler', email: 'traveler@example.com' };
  const book = (overrides = {}, key = crypto.randomUUID()) => createBooking(env, user, { room_id: 'room', ...dates(), adults: 2, children: 1, payment_provider: 'waafi', ...overrides }, key);
  const pay = (booking, overrides = {}) => settlePayment(env, booking.id, { provider: 'waafi', reference: `tx-${booking.id}`, amount_cents: 19965, currency: 'USD', source: 'manual', actor: admin.id, note: 'Funds verified in bank statement', ...overrides });
  const action = (path, body, method = 'POST') => adminOperations(new Request(`https://api.hoysii.com${path}`, { method, headers: { 'content-type': 'application/json', origin: 'https://admin.hoysii.com' }, body: JSON.stringify(body) }), env, new URL(`https://api.hoysii.com${path}`), admin);
  return { DB, env, user, book, pay, action, sent };
}

test('booking snapshots preserve exact prices, guest counts, terms and request identity', async () => {
  const f = await fixture();
  try {
    const booking = await f.book({}, 'one-request');
    assert.equal(booking.total_price, 199.65);
    assert.equal(booking.adults, 2);
    assert.equal(booking.children, 1);
    assert.match(booking.reference, /^HYS-[A-F0-9]{12}$/);
    await f.DB.exec("UPDATE hotels SET name='Changed',cancellation_policy='Changed',free_cancellation_hours=0; UPDATE rooms SET price_cents=9900 WHERE id='room'");
    const retry = await f.book({}, 'one-request');
    assert.equal(retry.id, booking.id);
    assert.equal(retry.total_price, 199.65);
    assert.equal(retry.hotels.name, 'Hotel One');
    assert.equal(retry.policy.free_cancellation_hours, 24);
    await assert.rejects(f.book({ children: 0 }, 'one-request'), { status: 409 });
  } finally { f.DB.close(); }
});

test('simultaneous requests cannot oversell the final room, including blocked inventory', async () => {
  const f = await fixture();
  try {
    const outcomes = await Promise.allSettled([f.book(), f.book()]);
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
    await assert.rejects(f.action('/v1/admin/rooms/room/blocks', { start_date: dates().check_in_date, end_date: dates().check_out_date, units: 1, reason: 'Outside reservation' }), /inventory_conflict/);
    await f.action('/v1/admin/rooms/room', { total_units: 2 }, 'PATCH');
    const blockResponse = await f.action('/v1/admin/rooms/room/blocks', { start_date: dates().check_in_date, end_date: dates().check_out_date, units: 1, reason: 'Outside reservation' });
    assert.equal(blockResponse.status, 201);
    await assert.rejects(f.book(), { status: 409 });
    await assert.rejects(f.action('/v1/admin/rooms/room', { total_units: 1 }, 'PATCH'), /inventory_conflict/);
    const available = await worker.fetch(new Request(`https://api.hoysii.com/v1/rooms/room/availability?check_in=${dates().check_in_date}&check_out=${dates().check_out_date}`), f.env);
    assert.equal((await available.json()).available, false);
    const afterCheckout = await f.book({ check_in_date: dates().check_out_date, check_out_date: new Date(Date.parse(dates().check_out_date) + 86400000).toISOString().slice(0,10) });
    assert.equal(afterCheckout.booking_status, 'payment_pending');
  } finally { f.DB.close(); }
});

test('unconfigured gateways fail explicitly and never record a payment or confirmation', async () => {
  const f = await fixture();
  try {
    const booking = await f.book();
    const path = `/v1/bookings/${booking.id}/payments`;
    await assert.rejects(travelerOperations(new Request(`https://api.hoysii.com${path}`, { method: 'POST' }), f.env, new URL(`https://api.hoysii.com${path}`), f.user), { code: 'PAYMENT_PROVIDER_NOT_CONFIGURED', status: 503 });
    assert.equal((await f.DB.prepare('SELECT COUNT(*) AS count FROM payments').first()).count, 0);
    assert.equal((await bookingRecord(f.env, booking.id)).payment_status, 'pending');
    await assert.rejects(f.pay(booking, { amount_cents: 1 }), { status: 400 });
    await assert.rejects(f.pay(booking, { currency: 'EUR' }), { status: 400 });
  } finally { f.DB.close(); }
});

test('settlement is idempotent, records receipts and confirms the traveler immediately', async () => {
  const f = await fixture();
  try {
    const booking = await f.book();
    const paid = await f.pay(booking);
    assert.equal(paid.booking_status, 'confirmed');
    assert.equal(paid.hotel_ack_status, 'pending');
    const stored = await bookingRecord(f.env, booking.id);
    assert.ok(Date.parse(`${stored.hotel_ack_due_at.replace(' ', 'T')}Z`) > Date.now() + 29 * 60000);
    assert.equal(Object.hasOwn(travelerBooking(stored), 'hotel_ack_status'), false);
    await f.pay(booking);
    assert.equal((await f.DB.prepare('SELECT COUNT(*) AS count FROM payments').first()).count, 1);
    assert.equal((await f.DB.prepare('SELECT COUNT(*) AS count FROM receipts').first()).count, 1);
    assert.equal((await f.DB.prepare("SELECT COUNT(*) AS count FROM notifications WHERE kind='hotel_booking'").first()).count, 1);
    await assert.rejects(f.pay(booking, { reference: 'another-reference' }), { status: 409 });
    await f.action(`/v1/admin/bookings/${booking.id}/acknowledgement`, { status: 'acknowledged', note: 'Reception confirmed by telephone' });
    assert.equal((await bookingRecord(f.env, booking.id)).hotel_ack_status, 'acknowledged');
  } finally { f.DB.close(); }
});

test('a late payment is preserved but cannot steal a room reserved by another traveler', async () => {
  const f = await fixture();
  try {
    const expired = await f.book();
    await f.DB.prepare("UPDATE bookings SET hold_expires_at=datetime('now','-1 minute') WHERE id=?").bind(expired.id).run();
    const next = await f.book();
    await f.pay(next);
    const recovered = await f.pay(expired);
    assert.equal(recovered.internal_status, 'recovery_required');
    assert.equal(recovered.payment_status, 'paid');
    assert.equal(recovered.exceptions[0].kind, 'payment_reservation_problem');
    assert.equal((await f.DB.prepare('SELECT COUNT(*) AS count FROM payments').first()).count, 2);
    assert.equal((await f.DB.prepare("SELECT COUNT(*) AS count FROM notifications WHERE booking_id=? AND kind='hotel_booking'").bind(expired.id).first()).count, 0);
    await f.action(`/v1/admin/bookings/${expired.id}/reassign`, { room_id: 'replacement-room', note: 'Guest accepted replacement at no extra charge' });
    const reassigned = await bookingRecord(f.env, expired.id);
    assert.equal(reassigned.room_id, 'replacement-room');
    assert.equal(reassigned.total_cents, 19965);
    assert.equal(JSON.parse(reassigned.policy_snapshot).free_cancellation_hours, 24);
  } finally { f.DB.close(); }
});

test('scheduled jobs expire holds, raise acknowledgement exceptions once and retry email', async () => {
  const f = await fixture();
  try {
    const booking = await f.book();
    await f.pay(booking);
    await f.DB.prepare("UPDATE bookings SET hotel_ack_due_at=datetime('now','-1 minute') WHERE id=?").bind(booking.id).run();
    f.env.SEND_EMAIL.send = async () => { throw new Error('Simulated email outage'); };
    await processJobs(f.env);
    assert.equal((await f.DB.prepare("SELECT COUNT(*) AS count FROM booking_exceptions WHERE kind='hotel_ack_overdue'").first()).count, 1);
    assert.equal((await f.DB.prepare("SELECT status FROM notifications WHERE kind='traveler_receipt'").first()).status, 'pending');
    await f.DB.exec("UPDATE notifications SET next_attempt_at=datetime('now','-1 minute')");
    f.env.SEND_EMAIL.send = async (message) => { f.sent.push(message); };
    await Promise.all([processJobs(f.env), processJobs(f.env)]);
    const sentCount = f.sent.length;
    await processJobs(f.env);
    assert.equal(f.sent.length, sentCount);
    assert.equal((await f.DB.prepare("SELECT COUNT(*) AS count FROM booking_exceptions WHERE kind='hotel_ack_overdue'").first()).count, 1);
    const unpaid = await f.book({ room_id: 'replacement-room' });
    await f.DB.prepare("UPDATE bookings SET hold_expires_at=datetime('now','-1 minute') WHERE id=?").bind(unpaid.id).run();
    await processJobs(f.env);
    assert.equal((await bookingRecord(f.env, unpaid.id)).booking_status, 'expired');
  } finally { f.DB.close(); }
});

test('cancellation releases inventory but only a completed refund changes money status', async () => {
  const f = await fixture();
  try {
    const booking = await f.book();
    await f.pay(booking);
    const stored = await bookingRecord(f.env, booking.id);
    assert.equal(refundQuote(stored), 19965);
    const cutoff = Date.parse(JSON.parse(stored.policy_snapshot).free_cancellation_until);
    assert.equal(refundQuote(stored, cutoff + 1), 14974);
    await f.action(`/v1/admin/bookings/${booking.id}/cancel`, { reason: 'Traveler requested cancellation' });
    const cancelled = await bookingRecord(f.env, booking.id);
    assert.equal(cancelled.booking_status, 'cancelled');
    assert.equal(cancelled.payment_status, 'paid');
    await f.book();
    const refund = await f.DB.prepare('SELECT * FROM refunds WHERE booking_id=?').bind(booking.id).first();
    await assert.rejects(f.action(`/v1/admin/refunds/${refund.id}`, { status: 'completed', reference: 'refund-tx', note: 'Money returned' }, 'PATCH'), { status: 409 });
    await f.action(`/v1/admin/refunds/${refund.id}`, { status: 'approved', note: 'Refund reviewed and approved' }, 'PATCH');
    assert.equal((await bookingRecord(f.env, booking.id)).payment_status, 'paid');
    await f.action(`/v1/admin/refunds/${refund.id}`, { status: 'completed', reference: 'refund-tx', note: 'Returned by bank transfer' }, 'PATCH');
    assert.equal((await bookingRecord(f.env, booking.id)).payment_status, 'refunded');
    await f.action(`/v1/admin/refunds/${refund.id}`, { status: 'completed', reference: 'refund-tx', note: 'Returned by bank transfer' }, 'PATCH');
    assert.equal((await f.DB.prepare("SELECT COUNT(*) AS count FROM booking_activity WHERE action='refund_completed'").first()).count, 1);
  } finally { f.DB.close(); }
});

test('booking, receipt and admin mutations enforce ownership and independent sessions', async () => {
  const f = await fixture();
  try {
    const auth = createAuth(f.env);
    await auth.api.signUpEmail({ body: { email: 'signed@example.com', password: 'SecurePass123!', name: 'Signed traveler' } });
    await f.DB.exec("UPDATE \"user\" SET emailVerified=1 WHERE email='signed@example.com'");
    const response = await auth.api.signInEmail({ body: { email: 'signed@example.com', password: 'SecurePass123!' }, asResponse: true });
    const cookie = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const booking = await f.book();
    await f.pay(booking);
    const request = (path, options = {}) => worker.fetch(new Request(`https://api.hoysii.com${path}`, { ...options, headers: { cookie, origin: 'hoysii://', 'content-type': 'application/json' } }), f.env);
    assert.equal((await request(`/v1/bookings/${booking.id}/receipt`)).status, 404);
    assert.equal((await request(`/v1/bookings/${booking.id}/cancellation`, { method: 'POST', body: JSON.stringify({ reason: 'Unauthorized cancellation' }) })).status, 404);
    assert.equal((await request(`/v1/admin/bookings/${booking.id}/payment`, { method: 'PATCH', body: JSON.stringify({ payment_status: 'paid' }) })).status, 401);
    const adminAuth = createAdminAuth(f.env);
    await adminAuth.api.signUpEmail({ body: { email: f.env.ADMIN_EMAIL, name: 'Admin', password: 'AdminSecurePass123!' } });
    await f.DB.exec('UPDATE admin_user SET emailVerified=1');
    const adminSignIn = await adminAuth.api.signInEmail({ body: { email: f.env.ADMIN_EMAIL, password: 'AdminSecurePass123!' }, asResponse: true });
    const adminCookie = adminSignIn.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    const untrusted = await worker.fetch(new Request(`https://api.hoysii.com/v1/admin/bookings/${booking.id}/notes`, { method: 'POST', headers: { cookie: adminCookie, origin: 'https://untrusted.example', 'content-type': 'application/json' }, body: JSON.stringify({ note: 'Should not be accepted' }) }), f.env);
    assert.equal(untrusted.status, 403);
    const receiptPath = `/v1/bookings/${booking.id}/receipt`;
    const ownReceipt = await travelerOperations(new Request(`https://api.hoysii.com${receiptPath}`), f.env, new URL(`https://api.hoysii.com${receiptPath}`), f.user);
    assert.equal((await ownReceipt.json()).amount_cents, 19965);
  } finally { f.DB.close(); }
});

test('an expired hold can be paid when inventory is still free, and transaction references cannot cross bookings', async () => {
  const f = await fixture();
  try {
    const booking = await f.book();
    await f.DB.prepare("UPDATE bookings SET hold_expires_at=datetime('now','-1 minute') WHERE id=?").bind(booking.id).run();
    await processJobs(f.env);
    assert.equal((await f.pay(booking)).internal_status, 'confirmed');
    const another = await f.book({ room_id: 'replacement-room' });
    await assert.rejects(f.pay(another, { reference: `tx-${booking.id}`, amount_cents: 29700 }), { status: 409 });
    assert.equal((await bookingRecord(f.env, another.id)).payment_status, 'pending');
  } finally { f.DB.close(); }
});

test('payment arriving after an unpaid cancellation is recorded with a full refund due', async () => {
  const f = await fixture();
  try {
    const booking = await f.book();
    await f.action(`/v1/admin/bookings/${booking.id}/cancel`, { note: 'Traveler cancelled before making payment' });
    const late = await f.pay(booking);
    assert.equal(late.internal_status, 'cancelled');
    assert.equal(late.refund.amount_cents, 19965);
    assert.equal(late.refund.status, 'requested');
    assert.ok(late.exceptions.some((issue) => issue.kind === 'payment_reservation_problem'));
  } finally { f.DB.close(); }
});

test('quote and creation agree on cents and fees and reject stale totals or policy', async () => {
  const f = await fixture();
  try {
    const range = dates();
    const response = await worker.fetch(new Request(`https://api.hoysii.com/v1/rooms/room/quote?check_in=${range.check_in_date}&check_out=${range.check_out_date}`), f.env);
    const quote = await response.json();
    assert.equal(quote.nightly_rate, 60.5);
    assert.equal(quote.service_fee, 18.15);
    assert.equal(quote.total_price, 199.65);
    await assert.rejects(f.book({ expected_total_cents: 19964 }), { status: 409 });
    await assert.rejects(f.book({ expected_policy: { ...quote.policy, penalty_percent: 0 } }), { status: 409 });
    const booking = await f.book({ expected_total_cents: 19965, expected_policy: quote.policy });
    assert.equal(booking.total_price, quote.total_price);
    assert.equal(booking.service_fee, quote.service_fee);
    const listed = await worker.fetch(new Request('https://api.hoysii.com/v1/hotels'), f.env);
    assert.equal((await listed.json()).find((hotel) => hotel.id === 'hotel').starting_price, 60.5);
  } finally { f.DB.close(); }
});

test('repeated late hotel responses can be escalated after reassignment, and exhausted email retries are visible', async () => {
  const f = await fixture();
  try {
    const booking = await f.book();
    await f.pay(booking);
    await f.DB.prepare("UPDATE bookings SET hotel_ack_due_at=datetime('now','-1 minute') WHERE id=?").bind(booking.id).run();
    await processJobs(f.env);
    await f.action(`/v1/admin/bookings/${booking.id}/reassign`, { room_id: 'replacement-room', note: 'Guest accepted replacement' });
    await f.DB.prepare("UPDATE bookings SET hotel_ack_due_at=datetime('now','-1 minute') WHERE id=?").bind(booking.id).run();
    await processJobs(f.env);
    assert.equal((await f.DB.prepare("SELECT COUNT(*) AS count FROM booking_exceptions WHERE kind='hotel_ack_overdue' AND status='open'").first()).count, 1);
    assert.equal((await f.DB.prepare("SELECT COUNT(*) AS count FROM booking_exceptions WHERE kind='hotel_ack_overdue' AND status='resolved'").first()).count, 1);
    await f.DB.exec("UPDATE notifications SET status='pending',attempts=7,next_attempt_at=datetime('now','-1 minute') WHERE kind='traveler_receipt'");
    f.env.SEND_EMAIL.send = async () => { throw new Error('Simulated permanent outage'); };
    await processJobs(f.env);
    assert.equal((await f.DB.prepare("SELECT status FROM notifications WHERE kind='traveler_receipt'").first()).status, 'failed');
    assert.equal((await f.DB.prepare("SELECT COUNT(*) AS count FROM booking_exceptions WHERE kind='notification_failed_traveler_receipt' AND status='open'").first()).count, 1);
  } finally { f.DB.close(); }
});

test('concurrent cancellation and payment cannot lose received funds or refund responsibility', async () => {
  const f = await fixture();
  try {
    const booking = await f.book();
    const outcomes = await Promise.allSettled([f.pay(booking), f.action(`/v1/admin/bookings/${booking.id}/cancel`, { note: 'Traveler cancellation received' })]);
    assert.equal(outcomes[0].status, 'fulfilled');
    const current = await bookingRecord(f.env, booking.id);
    if (current.booking_status !== 'cancelled') await f.action(`/v1/admin/bookings/${booking.id}/cancel`, { note: 'Refresh and apply cancellation against recorded payment' });
    const refund = await f.DB.prepare('SELECT * FROM refunds WHERE booking_id=?').bind(booking.id).first();
    assert.equal(refund.amount_cents, 19965);
    assert.equal(refund.status, 'requested');
    assert.equal((await f.DB.prepare('SELECT COUNT(*) AS count FROM payments WHERE booking_id=?').bind(booking.id).first()).count, 1);
  } finally { f.DB.close(); }
});

test('the operations migration preserves existing identities, payments and legacy history without inventing old terms', async () => {
  const DB = localD1({ beforeOperations(sqlite) {
    sqlite.exec(`INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES ('existing','Existing traveler','existing@example.com',1,1,1);
      INSERT INTO hotels(id,name,city) VALUES ('existing-hotel','Existing hotel','Garowe');
      INSERT INTO rooms(id,hotel_id,name,price_cents) VALUES ('existing-room','existing-hotel','Existing room',10000);
      INSERT INTO bookings(id,user_id,hotel_id,room_id,check_in_date,check_out_date,total_cents,payment_status,booking_status)
        VALUES ('existing-booking','existing','existing-hotel','existing-room','2025-01-01','2025-01-02',10000,'paid','confirmed');
      INSERT INTO legacy_users(id,clerk_id,full_name,email,created_at) VALUES ('legacy','legacy-clerk','Legacy traveler','legacy@example.com','2025-01-01');
      INSERT INTO legacy_bookings(id,user_id,hotel_id,room_id,check_in_date,check_out_date,total_cents,payment_status,booking_status,created_at)
        VALUES ('legacy-booking','legacy','existing-hotel','existing-room','2025-02-01','2025-02-02',15000,'paid','confirmed','2025-01-01');`);
  } });
  try {
    const booking = await DB.prepare('SELECT * FROM bookings').first();
    assert.equal(booking.total_cents, 10000);
    assert.equal(booking.payment_status, 'paid');
    assert.equal(booking.policy_snapshot, null);
    assert.equal(booking.hotel_snapshot, null);
    assert.match(booking.reference, /^HYS-/);
    assert.equal((await DB.prepare('SELECT email FROM "user"').first()).email, 'existing@example.com');
    assert.equal((await DB.prepare('SELECT total_cents FROM legacy_bookings').first()).total_cents, 15000);
  } finally { DB.close(); }
});
