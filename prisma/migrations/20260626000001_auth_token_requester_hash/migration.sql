-- Bind a magic-link token to the browser that requested it (login-CSRF / session
-- fixation defence). Additive + idempotent.
ALTER TABLE "auth_tokens" ADD COLUMN IF NOT EXISTS "requester_hash" TEXT;
