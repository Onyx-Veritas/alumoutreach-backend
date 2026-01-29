-- ============================================================
-- Migration: 001_init.sql
-- Purpose: Bootstrap migration infrastructure
-- ============================================================
-- Creates:
--   1. UUID extension (for gen_random_uuid())
--   2. Migration tracking table
--   3. Helper function for updated_at triggers
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id              SERIAL PRIMARY KEY,
    version         VARCHAR(255) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checksum        VARCHAR(64),
    execution_time  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);

-- Helper function: auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Record this migration
INSERT INTO schema_migrations (version, name) 
VALUES ('001', 'init')
ON CONFLICT (version) DO NOTHING;
