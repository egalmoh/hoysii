-- Owner applies this migration before the matching Git deployments. Existing records remain real.
ALTER TABLE bookings ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0 CHECK(is_test IN (0,1));
ALTER TABLE inventory_blocks ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0 CHECK(is_test IN (0,1));
ALTER TABLE hotel_payouts ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0 CHECK(is_test IN (0,1));
CREATE INDEX bookings_mode_room_dates ON bookings(is_test,room_id,check_in_date,check_out_date);

-- Live reservations and stakeholder reservations have independent inventory pools.
DROP TRIGGER bookings_inventory_insert;
CREATE TRIGGER bookings_inventory_insert BEFORE INSERT ON bookings
WHEN NEW.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required')
BEGIN
  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE nights(day) AS (
      SELECT NEW.check_in_date UNION ALL SELECT date(day, '+1 day') FROM nights WHERE day < date(NEW.check_out_date, '-1 day')
    ) SELECT 1 FROM nights n JOIN rooms r ON r.id = NEW.room_id
    WHERE (SELECT COUNT(*) FROM bookings b WHERE b.room_id = r.id AND b.is_test = NEW.is_test AND b.check_in_date <= n.day AND b.check_out_date > n.day
      AND b.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND b.payment_status != 'refunded'
      AND (b.booking_status != 'payment_pending' OR b.payment_status != 'pending' OR datetime(COALESCE(b.hold_expires_at, datetime(b.created_at, '+15 minutes'))) > datetime('now')))
      + (SELECT COALESCE(SUM(i.units), 0) FROM inventory_blocks i WHERE i.room_id = r.id AND i.is_test = NEW.is_test AND i.start_date <= n.day AND i.end_date > n.day) >= r.total_units
  ) THEN RAISE(ABORT, 'inventory_conflict') END;
END;

DROP TRIGGER bookings_inventory_update;
CREATE TRIGGER bookings_inventory_update BEFORE UPDATE OF room_id, check_in_date, check_out_date, booking_status, payment_status ON bookings
WHEN NEW.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND NEW.payment_status != 'refunded'
BEGIN
  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE nights(day) AS (
      SELECT NEW.check_in_date UNION ALL SELECT date(day, '+1 day') FROM nights WHERE day < date(NEW.check_out_date, '-1 day')
    ) SELECT 1 FROM nights n JOIN rooms r ON r.id = NEW.room_id
    WHERE (SELECT COUNT(*) FROM bookings b WHERE b.id != NEW.id AND b.room_id = r.id AND b.is_test = NEW.is_test AND b.check_in_date <= n.day AND b.check_out_date > n.day
      AND b.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND b.payment_status != 'refunded'
      AND (b.booking_status != 'payment_pending' OR b.payment_status != 'pending' OR datetime(COALESCE(b.hold_expires_at, datetime(b.created_at, '+15 minutes'))) > datetime('now')))
      + (SELECT COALESCE(SUM(i.units), 0) FROM inventory_blocks i WHERE i.room_id = r.id AND i.is_test = NEW.is_test AND i.start_date <= n.day AND i.end_date > n.day) >= r.total_units
  ) THEN RAISE(ABORT, 'inventory_conflict') END;
END;

DROP TRIGGER inventory_blocks_capacity;
CREATE TRIGGER inventory_blocks_capacity BEFORE INSERT ON inventory_blocks
BEGIN
  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE nights(day) AS (
      SELECT NEW.start_date UNION ALL SELECT date(day, '+1 day') FROM nights WHERE day < date(NEW.end_date, '-1 day')
    ) SELECT 1 FROM nights n JOIN rooms r ON r.id = NEW.room_id
    WHERE NEW.units + (SELECT COUNT(*) FROM bookings b WHERE b.room_id = r.id AND b.is_test = NEW.is_test AND b.check_in_date <= n.day AND b.check_out_date > n.day
      AND b.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND b.payment_status != 'refunded'
      AND (b.booking_status != 'payment_pending' OR b.payment_status != 'pending' OR datetime(COALESCE(b.hold_expires_at, datetime(b.created_at, '+15 minutes'))) > datetime('now')))
      + (SELECT COALESCE(SUM(i.units), 0) FROM inventory_blocks i WHERE i.room_id = r.id AND i.is_test = NEW.is_test AND i.start_date <= n.day AND i.end_date > n.day) > r.total_units
  ) THEN RAISE(ABORT, 'inventory_conflict') END;
END;

DROP TRIGGER rooms_capacity_update;
CREATE TRIGGER rooms_capacity_update BEFORE UPDATE OF total_units, capacity_adults ON rooms
BEGIN
  SELECT CASE WHEN EXISTS (
    WITH boundaries(day,is_test) AS (
      SELECT date('now'),0 UNION SELECT date('now'),1 UNION SELECT check_in_date,is_test FROM bookings WHERE room_id = NEW.id AND check_out_date > date('now')
      UNION SELECT start_date,is_test FROM inventory_blocks WHERE room_id = NEW.id AND end_date > date('now')
    ) SELECT 1 FROM boundaries n WHERE n.day >= date('now') AND
      (SELECT COUNT(*) FROM bookings b WHERE b.room_id = NEW.id AND b.is_test = n.is_test AND b.check_in_date <= n.day AND b.check_out_date > n.day
      AND b.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND b.payment_status != 'refunded'
      AND (b.booking_status != 'payment_pending' OR b.payment_status != 'pending' OR datetime(COALESCE(b.hold_expires_at, datetime(b.created_at, '+15 minutes'))) > datetime('now')))
      + (SELECT COALESCE(SUM(i.units), 0) FROM inventory_blocks i WHERE i.room_id = NEW.id AND i.is_test = n.is_test AND i.start_date <= n.day AND i.end_date > n.day) > NEW.total_units
  ) OR EXISTS (SELECT 1 FROM bookings b WHERE b.room_id = NEW.id AND b.check_out_date > date('now') AND COALESCE(b.adults,b.guests) > NEW.capacity_adults
    AND b.booking_status NOT IN ('cancelled', 'refunded', 'expired', 'recovery_required') AND b.payment_status != 'refunded'
    AND (b.booking_status != 'payment_pending' OR b.payment_status != 'pending' OR datetime(COALESCE(b.hold_expires_at, datetime(b.created_at, '+15 minutes'))) > datetime('now')))
  THEN RAISE(ABORT, 'inventory_conflict') END;
END;

CREATE TRIGGER bookings_test_mode_immutable BEFORE UPDATE OF is_test ON bookings
WHEN OLD.is_test != NEW.is_test
BEGIN
  SELECT RAISE(ABORT, 'booking_test_mode_immutable');
END;
CREATE TRIGGER payments_mode_guard BEFORE INSERT ON payments
WHEN ((SELECT is_test FROM bookings WHERE id=NEW.booking_id)=1 AND NEW.provider!='stakeholder_test')
  OR ((SELECT is_test FROM bookings WHERE id=NEW.booking_id)=0 AND NEW.provider='stakeholder_test')
BEGIN
  SELECT RAISE(ABORT, 'payment_test_mode_mismatch');
END;
