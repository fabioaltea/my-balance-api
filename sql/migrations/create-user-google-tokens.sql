-- Migration: Create user_google_tokens table
-- This table stores Google refresh tokens with UNIQUE constraint on (user_email, device_type)
-- Each user can have only ONE token per device type (web, ios, android)

-- 1. Create the table
CREATE TABLE IF NOT EXISTS user_google_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL REFERENCES users(user_email) ON DELETE CASCADE,
  device_type VARCHAR(10) NOT NULL DEFAULT 'web',
  google_refresh_token TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_email, device_type)
);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_google_tokens_user_device ON user_google_tokens(user_email, device_type);

-- 3. Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_google_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_google_tokens_updated_at ON user_google_tokens;
CREATE TRIGGER update_user_google_tokens_updated_at
    BEFORE UPDATE ON user_google_tokens
    FOR EACH ROW EXECUTE FUNCTION update_user_google_tokens_updated_at();

--4. Migrate existing tokens from sessions to user_google_tokens (optional)
This inserts the most recent token for each user+device_type combination
INSERT INTO user_google_tokens (user_email, device_type, google_refresh_token, created_at, updated_at)
SELECT DISTINCT ON (user_email, device_type)
    user_email,
    device_type,
    google_refresh_token,
    created_at,
    NOW()
FROM sessions
WHERE google_refresh_token IS NOT NULL
ORDER BY user_email, device_type, created_at DESC
ON CONFLICT (user_email, device_type) DO NOTHING;
