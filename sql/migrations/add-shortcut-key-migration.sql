-- Add shortcut_key column to users table for iOS Shortcuts integration
-- This allows users to add movements via Siri Shortcuts without full authentication

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS shortcut_key VARCHAR(128) UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_shortcut_key ON users(shortcut_key);

-- Add comment for documentation
COMMENT ON COLUMN users.shortcut_key IS 'Unique key for iOS Shortcuts integration - allows quick movement creation without JWT auth';
