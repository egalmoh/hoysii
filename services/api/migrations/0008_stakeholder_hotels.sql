-- The owner applies this before releasing the catalog/API. Existing hotels stay unchanged.
ALTER TABLE hotels ADD COLUMN stakeholder_only INTEGER NOT NULL DEFAULT 0 CHECK(stakeholder_only IN (0,1));

-- Defense in depth: simulated rooms must never receive real reservations, including reassignments.
CREATE TRIGGER stakeholder_hotels_booking_insert BEFORE INSERT ON bookings
WHEN NEW.is_test=0 AND EXISTS(SELECT 1 FROM rooms r JOIN hotels h ON h.id=r.hotel_id WHERE r.id=NEW.room_id AND h.stakeholder_only=1)
BEGIN
  SELECT RAISE(ABORT, 'stakeholder_hotel_requires_test_booking');
END;
CREATE TRIGGER stakeholder_hotels_booking_update BEFORE UPDATE OF room_id, hotel_id, is_test ON bookings
WHEN NEW.is_test=0 AND EXISTS(SELECT 1 FROM rooms r JOIN hotels h ON h.id=r.hotel_id WHERE r.id=NEW.room_id AND h.stakeholder_only=1)
BEGIN
  SELECT RAISE(ABORT, 'stakeholder_hotel_requires_test_booking');
END;
CREATE TRIGGER stakeholder_hotels_payout_insert BEFORE INSERT ON hotel_payouts
WHEN NEW.is_test=0 AND EXISTS(SELECT 1 FROM hotels WHERE id=NEW.hotel_id AND stakeholder_only=1)
BEGIN
  SELECT RAISE(ABORT, 'stakeholder_hotel_requires_test_payout');
END;
CREATE TRIGGER stakeholder_hotels_payout_update BEFORE UPDATE OF hotel_id,is_test ON hotel_payouts
WHEN NEW.is_test=0 AND EXISTS(SELECT 1 FROM hotels WHERE id=NEW.hotel_id AND stakeholder_only=1)
BEGIN
  SELECT RAISE(ABORT, 'stakeholder_hotel_requires_test_payout');
END;
