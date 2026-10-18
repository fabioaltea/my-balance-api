BEGIN;
-- Credentials and OAuth tables are owned and migrated by AuthService.
CREATE TABLE IF NOT EXISTS chatgpt_model_preferences (
  user_email VARCHAR(255) NOT NULL REFERENCES users(user_email) ON DELETE CASCADE,
  product_name TEXT NOT NULL DEFAULT 'MyBalance',
  connection_id UUID NOT NULL,
  model_slug TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_email, product_name, connection_id)
);
COMMIT;
