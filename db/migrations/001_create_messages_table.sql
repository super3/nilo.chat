-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  username VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  channel VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on channel for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);

-- Create index on timestamp for ordering
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);

-- Create composite index for channel + timestamp queries
CREATE INDEX IF NOT EXISTS idx_messages_channel_timestamp ON messages(channel, timestamp DESC);
