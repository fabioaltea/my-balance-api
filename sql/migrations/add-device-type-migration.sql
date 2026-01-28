-- Migration to add device_type column to sessions table
-- Run this script to update the database schema

ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS device_type VARCHAR(10) DEFAULT 'web';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_device_type ON sessions(device_type);

-- Update existing records to have 'web' as default device type
UPDATE sessions 
SET device_type = 'web' 
WHERE device_type IS NULL;

-- Add check constraint to ensure only valid device types
ALTER TABLE sessions 
ADD CONSTRAINT check_device_type 
CHECK (device_type IN ('web', 'ios', 'android'));