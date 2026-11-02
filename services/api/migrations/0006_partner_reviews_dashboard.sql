-- Partner identities and sessions are independent of traveler Better Auth records.
CREATE TABLE IF NOT EXISTS partner_user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS partner_session (
  id TEXT PRIMARY KEY,
  expiresAt INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES partner_user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS partner_account (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES partner_user(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS partner_verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE INDEX IF NOT EXISTS partner_sessions_user_id_idx ON partner_session(userId);
CREATE INDEX IF NOT EXISTS partner_accounts_user_id_idx ON partner_account(userId);
CREATE INDEX IF NOT EXISTS partner_verification_identifier_idx ON partner_verification(identifier);


-- An active membership is required at signup, sign-in and every partner API request.
CREATE TABLE partner_memberships (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email,hotel_id)
);
CREATE INDEX partner_membership_access ON partner_memberships(email,active,hotel_id);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
  user_id TEXT NOT NULL REFERENCES "user"(id),
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK(length(comment) BETWEEN 10 AND 1000),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)),
  moderation_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX reviews_hotel ON reviews(hotel_id,hidden,created_at);

-- These are records of manually arranged payouts, never instructions to move money.
CREATE TABLE hotel_payouts (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL REFERENCES hotels(id),
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
  status TEXT NOT NULL CHECK(status IN ('scheduled','paid','cancelled')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL CHECK(period_end>=period_start),
  reference TEXT UNIQUE,
  note TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);

CREATE TABLE saved_hotels (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  hotel_id TEXT NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,hotel_id)
);
