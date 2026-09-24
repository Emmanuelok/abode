CREATE TABLE IF NOT EXISTS request_intake_limits (
  key TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS request_intake_limits_window ON request_intake_limits(window_start);
