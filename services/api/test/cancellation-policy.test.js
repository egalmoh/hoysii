import test from 'node:test';
import assert from 'node:assert/strict';
import { policyFor, refundQuote, validatePolicy } from '../src/booking-service.js';

test('new bookings keep the original 24-hour and first-night rule despite old hotel defaults', () => {
  for (const hotel of [{}, { free_cancellation_hours: null, cancellation_policy: 'Contact support' }, { free_cancellation_hours: 48, cancellation_penalty_percent: 25, cancellation_policy: 'Different terms' }]) {
    const policy = policyFor(hotel, '2026-12-01');
    assert.equal(policy.free_cancellation_hours, 24);
    assert.equal(policy.penalty_type, 'first_night');
    assert.equal(policy.free_cancellation_until, '2026-11-30T11:00:00.000Z');
    assert.match(policy.text, /refund minus the first night/);
    assert.equal(Object.hasOwn(policy, 'penalty_percent'), false);
  }
  assert.equal(policyFor({ check_in_time: '00:30' }, '2028-03-01').free_cancellation_until, '2028-02-28T21:30:00.000Z');
  const edited = validatePolicy({ check_in_time: '16:00', free_cancellation_hours: 48, cancellation_penalty_percent: 0 });
  assert.equal(edited.check_in_time, '16:00');
  assert.equal(edited.free_cancellation_hours, 24);
  assert.match(edited.cancellation_policy, /refund minus the first night/);
});

test('refund is full through the cutoff then deducts exactly the saved first night', () => {
  const policy = policyFor({}, '2026-12-01');
  const booking = { payment_status: 'paid', total_cents: 19965, nightly_cents: 6050, policy_snapshot: JSON.stringify(policy) };
  const cutoff = Date.parse(policy.free_cancellation_until);
  assert.equal(refundQuote(booking, cutoff - 1), 19965);
  assert.equal(refundQuote(booking, cutoff), 19965);
  assert.equal(refundQuote(booking, cutoff + 1), 13915);
  assert.equal(refundQuote({ ...booking, total_cents: 6655 }, cutoff + 1), 605);
  assert.equal(refundQuote({ ...booking, total_cents: 5000 }, cutoff + 1), 0);
  assert.equal(refundQuote({ ...booking, nightly_cents: null }, cutoff + 1), null);
  assert.equal(refundQuote({ ...booking, payment_status: 'pending' }, cutoff + 1), 0);
});

test('previously saved cancellation terms are not rewritten for historical bookings', () => {
  const policy = { text: 'Agreed previous terms', free_cancellation_hours: 24, free_cancellation_until: '2026-11-30T11:00:00.000Z', penalty_percent: 25 };
  const booking = { payment_status: 'paid', total_cents: 19965, nightly_cents: 6050, policy_snapshot: JSON.stringify(policy) };
  assert.equal(refundQuote(booking, Date.parse(policy.free_cancellation_until) + 1), 14974);
  assert.deepEqual(JSON.parse(booking.policy_snapshot), policy);
  assert.equal(refundQuote({ ...booking, policy_snapshot: null }), null);
});
