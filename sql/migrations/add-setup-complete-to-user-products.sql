-- Add setup_complete column to user_products table
-- When FALSE, the user is still in onboarding (even if spreadsheet_id is set)
-- When TRUE, the user has completed the full onboarding flow

ALTER TABLE user_products ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN DEFAULT FALSE;
