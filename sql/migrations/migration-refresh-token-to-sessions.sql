-- Migration: Move google_refresh_token from users to sessions
-- This is the correct architecture: refresh tokens are per-session, not per-user
-- A user can have multiple sessions (web, iOS, Android) each with its own refresh token

-- 1. Add google_refresh_token column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;

-- 2. The device_type column should already exist, but ensure it does
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_type VARCHAR(10) DEFAULT 'web';

-- 3. Optional: Remove the columns from users table (do this AFTER migrating and testing)
-- WARNING: Only run these after confirming everything works!
-- ALTER TABLE users DROP COLUMN IF EXISTS google_refresh_token;
-- ALTER TABLE users DROP COLUMN IF EXISTS google_device_type;

-- 4. Create index for faster lookups by user_email and device_type
CREATE INDEX IF NOT EXISTS idx_sessions_user_device ON sessions(user_email, device_type);
