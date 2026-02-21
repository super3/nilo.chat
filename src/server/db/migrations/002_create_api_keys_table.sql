-- Create api_keys table for agent authentication
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  agent_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast key lookups during authentication
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
