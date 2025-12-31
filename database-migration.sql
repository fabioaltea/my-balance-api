-- Database migration for new authentication system
-- Run these commands in your PostgreSQL database

-- 1. Add new columns to users table (user_email is already PRIMARY KEY)
ALTER TABLE users ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Note: user_email remains the primary key, id is just a unique identifier for future use

-- 2. Create sessions table for refresh token management
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL REFERENCES users(user_email) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  scopes JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_email ON sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(user_email);
CREATE INDEX IF NOT EXISTS idx_users_id ON users(id);

-- 3. Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    return NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Clean up expired sessions automatically (optional)
-- You can run this periodically or set up a cron job
-- DELETE FROM sessions WHERE expires_at < NOW();

-- 5. Example environment variables you need to set:
-- ENCRYPTION_KEY=<64-character-hex-string>  # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
-- JWT_PRIVATE_KEY=<RSA-private-key-in-PEM-format>
-- JWT_PUBLIC_KEY=<RSA-public-key-in-PEM-format>

-- Generate RSA keys with:
-- openssl genrsa -out private.pem 2048
-- openssl rsa -in private.pem -pubout -out public.pem

-- Note: Make sure to update your existing user records to include google_sub
-- This might require manual data migration depending on your current setup