-- Apply this after creating the PlanetScale Postgres database.  Better Auth's
-- generated tables are kept here so the entire first release is reproducible.
CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session (
  id text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  scope text,
  password text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp,
  "updatedAt" timestamp
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON session("userId");
CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON account("userId");
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

CREATE TABLE IF NOT EXISTS profiles (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  full_name text,
  phone_number text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotels (
  id text PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL,
  address jsonb NOT NULL DEFAULT '[]'::jsonb,
  google_map_link text,
  description text,
  starting_price numeric(12, 2) NOT NULL DEFAULT 0,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  manager_phone text,
  manager_email text,
  manager_name text,
  is_verified boolean NOT NULL DEFAULT false,
  rating numeric(3, 2),
  payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  security_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  hotel_id text NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(12, 2) NOT NULL,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  capacity_adults integer NOT NULL DEFAULT 2,
  bed_size text,
  total_units integer NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rooms_hotel_id_idx ON rooms(hotel_id);

CREATE TABLE IF NOT EXISTS bookings (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id),
  hotel_id text NOT NULL REFERENCES hotels(id),
  room_id text NOT NULL REFERENCES rooms(id),
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  total_price numeric(12, 2) NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending',
  payment_provider text,
  booking_status text NOT NULL DEFAULT 'payment_pending',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_hotel_id_idx ON bookings(hotel_id);
