-- 0001_init.sql
-- Forward-only initial schema. Idempotent where practical so it is safe to
-- re-run against an existing database (CI, local resets).

-- Extensions ----------------------------------------------------------------
-- gen_random_uuid() is built into Postgres 13+, but pgcrypto guarantees it.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- citext gives us case-insensitive, unique investor emails without lower() hacks.
CREATE EXTENSION IF NOT EXISTS citext;

-- Enums ---------------------------------------------------------------------
-- Native enums are self-documenting and reject bad values at the DB boundary.
-- Trade-off: adding a value later needs ALTER TYPE (noted in the README).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fund_status') THEN
    CREATE TYPE fund_status AS ENUM ('Fundraising', 'Investing', 'Closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investor_type') THEN
    CREATE TYPE investor_type AS ENUM ('Individual', 'Institution', 'Family Office');
  END IF;
END$$;

-- Tables --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  vintage_year    integer NOT NULL CHECK (vintage_year BETWEEN 1900 AND extract(year FROM now())::int + 1),
  -- Money is NUMERIC(20,2): exact decimal, never float/double/money type.
  target_size_usd numeric(20, 2) NOT NULL CHECK (target_size_usd > 0),
  status          fund_status NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  investor_type investor_type NOT NULL,
  -- citext makes the UNIQUE constraint case-insensitive.
  email         citext NOT NULL UNIQUE CHECK (length(email) <= 254 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id     uuid NOT NULL REFERENCES investors(id) ON DELETE RESTRICT,
  fund_id         uuid NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  amount_usd      numeric(20, 2) NOT NULL CHECK (amount_usd > 0),
  -- An investment cannot be dated in the future.
  investment_date date NOT NULL CHECK (investment_date <= current_date)
  -- NOTE: deliberately NOT UNIQUE on (fund_id, investor_id): in private markets an
  -- investor can commit to the same fund more than once (top-ups). See README.
);

-- Indexes -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_investments_fund_id ON investments (fund_id);
CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON investments (investor_id);
