-- All timestamps are unix epoch milliseconds.

CREATE TABLE owner_users (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- exactly one owner, ever
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY, -- sha256 of the cookie token; the raw token is never stored
  owner_id INTEGER NOT NULL REFERENCES owner_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE login_failures (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX login_failures_ip_at ON login_failures (ip, at);

CREATE TABLE instagram_accounts (
  id INTEGER PRIMARY KEY,
  instagram_user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  token_expires_at INTEGER,
  connection_status TEXT NOT NULL CHECK (connection_status IN ('connected', 'expired', 'disconnected')),
  paused_until INTEGER, -- circuit breaker after a Meta policy block (error 368)
  last_api_success_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE automations (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('comment', 'dm', 'story_reply')),
  media_id TEXT, -- NULL = any post (comment triggers only)
  media_caption TEXT,
  match_mode TEXT NOT NULL CHECK (match_mode IN ('exact', 'contains', 'any')),
  initial_message TEXT NOT NULL,
  button_label TEXT NOT NULL,
  comment_replies TEXT NOT NULL DEFAULT '', -- newline separated, one picked at random
  require_follow INTEGER NOT NULL DEFAULT 1,
  content_message TEXT NOT NULL,
  content_url TEXT,
  link_button_label TEXT NOT NULL,
  not_following_message TEXT NOT NULL,
  verification_error_message TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX automations_lookup ON automations (account_id, is_active, trigger_type, media_id);

CREATE TABLE automation_keywords (
  id INTEGER PRIMARY KEY,
  automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX automation_keywords_automation ON automation_keywords (automation_id);

CREATE TABLE webhook_events (
  id INTEGER PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE, -- comment:<id> or msg:<mid>; Meta redeliveries hit this
  comment_id TEXT,
  media_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('comment', 'messaging')),
  payload TEXT NOT NULL,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('received', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  received_at INTEGER NOT NULL,
  processed_at INTEGER
);
CREATE INDEX webhook_events_retry ON webhook_events (processing_status, received_at);

CREATE TABLE verification_attempts (
  id INTEGER PRIMARY KEY,
  automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  instagram_user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('following', 'not_following', 'unknown', 'failed')),
  api_error_code TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX verification_attempts_created ON verification_attempts (created_at);

CREATE TABLE dm_logs (
  id INTEGER PRIMARY KEY,
  automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  comment_id TEXT,
  instagram_user_id TEXT NOT NULL,
  matched_keyword TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('initial', 'comment_reply', 'content', 'not_following', 'error')),
  message_status TEXT NOT NULL CHECK (message_status IN ('pending', 'sent', 'failed')),
  meta_message_id TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX dm_logs_created ON dm_logs (created_at);
CREATE INDEX dm_logs_user ON dm_logs (instagram_user_id, message_type);
-- Idempotency lives in the database: a second send for the same comment, or a second
-- content delivery to the same person, cannot be inserted. Failed rows don't block retries.
CREATE UNIQUE INDEX dm_logs_once_per_comment ON dm_logs (comment_id, message_type)
  WHERE comment_id IS NOT NULL AND message_type IN ('initial', 'comment_reply') AND message_status != 'failed';
CREATE UNIQUE INDEX dm_logs_content_once ON dm_logs (automation_id, instagram_user_id)
  WHERE message_type = 'content' AND message_status != 'failed';
