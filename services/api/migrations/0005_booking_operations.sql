-- Apply before deploying the matching API/admin/traveler code. Preserves existing records.
ALTER TABLE hotels ADD COLUMN check_in_time TEXT NOT NULL DEFAULT '14:00';
ALTER TABLE hotels ADD COLUMN check_out_time TEXT NOT NULL DEFAULT '12:00';
ALTER TABLE hotels ADD COLUMN cancellation_policy TEXT NOT NULL DEFAULT 'Contact Hoysii support for cancellation terms.';
ALTER TABLE hotels ADD COLUMN free_cancellation_hours INTEGER;
ALTER TABLE hotels ADD COLUMN cancellation_penalty_percent INTEGER NOT NULL DEFAULT 100;

ALTER TABLE bookings ADD COLUMN reference TEXT;
ALTER TABLE bookings ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE bookings ADD COLUMN nightly_cents INTEGER;
ALTER TABLE bookings ADD COLUMN service_fee_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN adults INTEGER;
ALTER TABLE bookings ADD COLUMN children INTEGER;
ALTER TABLE bookings ADD COLUMN hotel_snapshot TEXT;
ALTER TABLE bookings ADD COLUMN room_snapshot TEXT;
ALTER TABLE bookings ADD COLUMN policy_snapshot TEXT;
ALTER TABLE bookings ADD COLUMN hold_expires_at TEXT;
ALTER TABLE bookings ADD COLUMN paid_at TEXT;
ALTER TABLE bookings ADD COLUMN hotel_ack_status TEXT NOT NULL DEFAULT 'not_sent';
ALTER TABLE bookings ADD COLUMN hotel_ack_due_at TEXT;
ALTER TABLE bookings ADD COLUMN hotel_ack_at TEXT;
ALTER TABLE bookings ADD COLUMN checked_in_at TEXT;
ALTER TABLE bookings ADD COLUMN completed_at TEXT;
UPDATE bookings SET reference = 'HYS-' || upper(replace(id, '-', '')),
  hold_expires_at = datetime(created_at, '+15 minutes');
CREATE UNIQUE INDEX bookings_reference_idx ON bookings(reference);

CREATE TABLE inventory_blocks (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL CHECK(end_date > start_date),
  units INTEGER NOT NULL CHECK(units > 0),
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX inventory_blocks_room_dates_idx ON inventory_blocks(room_id, start_date, end_date);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  provider TEXT NOT NULL,
  reference TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('manual', 'provider')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'succeeded', 'failed')),
  recorded_by TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, reference)
);
CREATE UNIQUE INDEX payments_one_success_idx ON payments(booking_id) WHERE status = 'succeeded';

CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
  payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id),
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE booking_activity (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX booking_activity_booking_idx ON booking_activity(booking_id, created_at);
CREATE TABLE booking_exceptions (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved')),
  owner TEXT,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE UNIQUE INDEX booking_exceptions_open_idx ON booking_exceptions(booking_id, kind) WHERE status = 'open';
CREATE TABLE cancellation_requests (
  booking_id TEXT PRIMARY KEY REFERENCES bookings(id),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT NOT NULL,
  estimated_refund_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested', 'approved', 'declined'))
);
CREATE TABLE refunds (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested', 'approved', 'processing', 'completed', 'failed', 'rejected')),
  reason TEXT NOT NULL,
  reference TEXT UNIQUE,
  recorded_by TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_until TEXT,
  lease_token TEXT,
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(booking_id, kind)
);
CREATE INDEX notifications_due_idx ON notifications(status, next_attempt_at);

-- Inventory is enforced on every write, including payment settlement and reassignment.
CREATE TRIGGER bookings_inventory_insert BEFORE INSERT ON bookings
WHEN NEW.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required')
BEGIN
  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE nights(day) AS (
      SELECT NEW.check_in_date UNION ALL SELECT date(day, '+1 day') FROM nights WHERE day < date(NEW.check_out_date, '-1 day')
    ) SELECT 1 FROM nights n JOIN rooms r ON r.id = NEW.room_id
    WHERE (SELECT COUNT(*) FROM bookings b WHERE b.room_id = r.id AND b.check_in_date <= n.day AND b.check_out_date > n.day
      AND b.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND b.payment_status != 'refunded'
      AND (b.booking_status != 'payment_pending' OR b.payment_status != 'pending' OR datetime(COALESCE(b.hold_expires_at, datetime(b.created_at, '+15 minutes'))) > datetime('now')))
      + (SELECT COALESCE(SUM(i.units), 0) FROM inventory_blocks i WHERE i.room_id = r.id AND i.start_date <= n.day AND i.end_date > n.day) >= r.total_units
  ) THEN RAISE(ABORT, 'inventory_conflict') END;
END;
CREATE TRIGGER bookings_inventory_update BEFORE UPDATE OF room_id, check_in_date, check_out_date, booking_status, payment_status ON bookings
WHEN NEW.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND NEW.payment_status != 'refunded'
BEGIN
  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE nights(day) AS (
      SELECT NEW.check_in_date UNION ALL SELECT date(day, '+1 day') FROM nights WHERE day < date(NEW.check_out_date, '-1 day')
    ) SELECT 1 FROM nights n JOIN rooms r ON r.id = NEW.room_id
    WHERE (SELECT COUNT(*) FROM bookings b WHERE b.id != NEW.id AND b.room_id = r.id AND b.check_in_date <= n.day AND b.check_out_date > n.day
      AND b.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND b.payment_status != 'refunded'
      AND (b.booking_status != 'payment_pending' OR b.payment_status != 'pending' OR datetime(COALESCE(b.hold_expires_at, datetime(b.created_at, '+15 minutes'))) > datetime('now')))
      + (SELECT COALESCE(SUM(i.units), 0) FROM inventory_blocks i WHERE i.room_id = r.id AND i.start_date <= n.day AND i.end_date > n.day) >= r.total_units
  ) THEN RAISE(ABORT, 'inventory_conflict') END;
END;
CREATE TRIGGER inventory_blocks_capacity BEFORE INSERT ON inventory_blocks
BEGIN
  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE nights(day) AS (
      SELECT NEW.start_date UNION ALL SELECT date(day, '+1 day') FROM nights WHERE day < date(NEW.end_date, '-1 day')
    ) SELECT 1 FROM nights n JOIN rooms r ON r.id = NEW.room_id
    WHERE NEW.units + (SELECT COUNT(*) FROM bookings b WHERE b.room_id = r.id AND b.check_in_date <= n.day AND b.check_out_date > n.day
      AND b.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND b.payment_status != 'refunded'
      AND (b.booking_status != 'payment_pending' OR b.payment_status != 'pending' OR datetime(COALESCE(b.hold_expires_at, datetime(b.created_at, '+15 minutes'))) > datetime('now')))
      + (SELECT COALESCE(SUM(i.units), 0) FROM inventory_blocks i WHERE i.room_id = r.id AND i.start_date <= n.day AND i.end_date > n.day) > r.total_units
  ) THEN RAISE(ABORT, 'inventory_conflict') END;
END;
CREATE TRIGGER rooms_capacity_update BEFORE UPDATE OF total_units, capacity_adults ON rooms
BEGIN
  SELECT CASE WHEN EXISTS (
    WITH boundaries(day) AS (
      SELECT date('now') UNION SELECT check_in_date FROM bookings WHERE room_id = NEW.id AND check_out_date > date('now')
      UNION SELECT start_date FROM inventory_blocks WHERE room_id = NEW.id AND end_date > date('now')
    ) SELECT 1 FROM boundaries n WHERE n.day >= date('now') AND
      (SELECT COUNT(*) FROM bookings b WHERE b.room_id = NEW.id AND b.check_in_date <= n.day AND b.check_out_date > n.day
      AND b.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND b.payment_status != 'refunded'
      AND (b.booking_status != 'payment_pending' OR b.payment_status != 'pending' OR datetime(COALESCE(b.hold_expires_at, datetime(b.created_at, '+15 minutes'))) > datetime('now')))
      + (SELECT COALESCE(SUM(i.units), 0) FROM inventory_blocks i WHERE i.room_id = NEW.id AND i.start_date <= n.day AND i.end_date > n.day) > NEW.total_units
  ) OR EXISTS (SELECT 1 FROM bookings b WHERE b.room_id = NEW.id AND b.check_out_date > date('now') AND COALESCE(b.adults,b.guests) > NEW.capacity_adults
    AND b.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND b.payment_status != 'refunded'
    AND (b.booking_status != 'payment_pending' OR b.payment_status != 'pending' OR datetime(COALESCE(b.hold_expires_at, datetime(b.created_at, '+15 minutes'))) > datetime('now')))
  THEN RAISE(ABORT, 'inventory_conflict') END;
END;
CREATE TRIGGER bookings_guest_capacity BEFORE UPDATE OF adults, room_id ON bookings
WHEN NEW.adults > (SELECT capacity_adults FROM rooms WHERE id=NEW.room_id)
BEGIN
  SELECT RAISE(ABORT, 'inventory_conflict');
END;
