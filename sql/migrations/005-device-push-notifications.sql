BEGIN;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS app_variant TEXT NOT NULL DEFAULT 'production';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
UPDATE sessions SET expires_at = COALESCE(created_at, NOW()) + INTERVAL '30 days' WHERE expires_at IS NULL;
ALTER TABLE sessions ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 days');
ALTER TABLE sessions ALTER COLUMN expires_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS push_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255) NOT NULL REFERENCES users(user_email) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  product_name TEXT NOT NULL,
  app_variant TEXT NOT NULL CHECK (app_variant IN ('development', 'production')),
  expo_project_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  expo_push_token TEXT,
  permission_status TEXT NOT NULL DEFAULT 'undetermined',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invalidated_at TIMESTAMPTZ,
  UNIQUE (user_email, device_id, product_name, app_variant)
);
CREATE UNIQUE INDEX IF NOT EXISTS push_devices_unique_token
  ON push_devices(expo_project_id, expo_push_token) WHERE expo_push_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS push_devices_unique_destination
  ON push_devices(device_id, product_name, app_variant) WHERE expo_push_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS push_devices_recipients ON push_devices(user_email, product_name, app_variant) WHERE enabled;

CREATE TABLE IF NOT EXISTS push_notification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id TEXT NOT NULL,
  user_email VARCHAR(255) NOT NULL REFERENCES users(user_email) ON DELETE CASCADE,
  push_device_id UUID REFERENCES push_devices(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'accepted', 'done', 'failed', 'unknown', 'skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  ticket_id TEXT,
  error_code TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(movement_id, expo_push_token)
);
CREATE INDEX IF NOT EXISTS push_jobs_due ON push_notification_jobs(next_attempt_at) WHERE status IN ('pending', 'accepted');
COMMIT;
