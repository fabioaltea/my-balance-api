-- Migration: Add user_name, user_picture and push_token columns to users table
-- Run this migration to store Google profile information and push notifications

-- Add user_name column (full name from Google)
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);

-- Add user_picture column (profile picture URL from Google)
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_picture TEXT;

-- Add push_token column (Expo push notification token)
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Optional: Add comment for documentation
COMMENT ON COLUMN users.user_name IS 'User full name from Google profile';
COMMENT ON COLUMN users.user_picture IS 'Profile picture URL from Google';
COMMENT ON COLUMN users.push_token IS 'Expo push notification token';
