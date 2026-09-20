-- Logged-out JWTs (SHA-256 hashed) so revocations survive a restart/redeploy.
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
    token_hash varchar(64) PRIMARY KEY,
    expires_at timestamp(6) with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blacklisted_tokens_expires_at ON blacklisted_tokens (expires_at);
