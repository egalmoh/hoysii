-- Keep legacy Clerk-era records separate from Better Auth accounts. A traveler
-- may view their history only after verifying the same email in Better Auth.
CREATE TABLE IF NOT EXISTS legacy_users (
  id TEXT PRIMARY KEY,
  clerk_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  phone_number TEXT,
  role TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS legacy_bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES legacy_users(id),
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  room_id TEXT NOT NULL REFERENCES rooms(id),
  check_in_date TEXT NOT NULL,
  check_out_date TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
  payment_provider TEXT,
  transaction_reference TEXT,
  receipt_image_url TEXT,
  payment_status TEXT NOT NULL,
  booking_status TEXT NOT NULL,
  payout_held_until TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS legacy_bookings_user_id_idx ON legacy_bookings(user_id);
