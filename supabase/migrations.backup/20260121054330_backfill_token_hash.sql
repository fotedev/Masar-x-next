-- Backfill token_hash using SHA-256 of plaintext token
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE password_reset_tokens
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;
