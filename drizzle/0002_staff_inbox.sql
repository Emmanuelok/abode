CREATE TABLE IF NOT EXISTS request_audit (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS request_audit_request_date ON request_audit(request_id, created_at);
CREATE INDEX IF NOT EXISTS requests_status_date ON requests(status, created_at);
