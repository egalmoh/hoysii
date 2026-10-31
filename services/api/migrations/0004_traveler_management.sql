-- Admin controls are keyed by email so a legacy traveler and their new Better Auth
-- account cannot have different block states.
CREATE TABLE IF NOT EXISTS traveler_controls (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  is_blocked INTEGER NOT NULL DEFAULT 0,
  invited_name TEXT,
  invited_phone TEXT,
  invited_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
