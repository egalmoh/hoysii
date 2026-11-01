import test from 'node:test';
import assert from 'node:assert/strict';
import { cancellationCutoff, formatCancellationDate } from '../lib/cancellation-policy.js';

test('selected dates update the original cancellation deadline, including month boundaries', () => {
  assert.equal(formatCancellationDate(cancellationCutoff('2026-12-01')), 'Nov 30, 2026');
  assert.equal(formatCancellationDate(cancellationCutoff('2026-12-02')), 'Dec 1, 2026');
  assert.equal(cancellationCutoff('2028-03-01', '00:30'), '2028-02-28T21:30:00.000Z');
  assert.equal(formatCancellationDate(cancellationCutoff('2028-03-01', '00:30')), 'Feb 29, 2028');
});

test('no cancellation date is fabricated for missing or invalid selections', () => {
  for (const date of ['', undefined, '2026-02-30', 'invalid']) assert.equal(cancellationCutoff(date), null);
  assert.equal(cancellationCutoff('2026-12-01', '27:00'), null);
  assert.equal(formatCancellationDate(null), '');
  assert.equal(formatCancellationDate('invalid'), '');
});
