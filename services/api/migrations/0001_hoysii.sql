-- Cloudflare D1 schema. Monetary values are stored as integer US cents.
CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  expiresAt INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope TEXT,
  password TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON session(userId);
CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON account(userId);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '[]',
  google_map_link TEXT,
  description TEXT,
  starting_price_cents INTEGER NOT NULL DEFAULT 0 CHECK(starting_price_cents >= 0),
  images TEXT NOT NULL DEFAULT '[]',
  amenities TEXT NOT NULL DEFAULT '[]',
  manager_phone TEXT,
  manager_email TEXT,
  manager_name TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  rating REAL,
  payment_methods TEXT NOT NULL DEFAULT '[]',
  security_features TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  amenities TEXT NOT NULL DEFAULT '[]',
  images TEXT NOT NULL DEFAULT '[]',
  capacity_adults INTEGER NOT NULL DEFAULT 2,
  bed_size TEXT,
  total_units INTEGER NOT NULL DEFAULT 1 CHECK(total_units > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS rooms_hotel_id_idx ON rooms(hotel_id);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id),
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  room_id TEXT NOT NULL REFERENCES rooms(id),
  check_in_date TEXT NOT NULL,
  check_out_date TEXT NOT NULL,
  guests INTEGER NOT NULL DEFAULT 1,
  total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_provider TEXT,
  booking_status TEXT NOT NULL DEFAULT 'payment_pending',
  idempotency_key TEXT UNIQUE,
  transaction_reference TEXT,
  receipt_image_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_hotel_id_idx ON bookings(hotel_id);
CREATE INDEX IF NOT EXISTS bookings_room_dates_idx ON bookings(room_id, check_in_date, check_out_date);
