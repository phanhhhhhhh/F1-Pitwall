-- email_verified: whether the account's mailbox has been proven (Google login, OTP, password
-- reset, or operator-provisioned). Unverified accounts can be "claimed" by whoever later
-- proves control of the mailbox — see EmailOwnershipService.
-- password_changed_at: JWTs issued before this instant are rejected, so a password change or
-- reset ends every existing session.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at timestamp(6) with time zone;

-- Google-created accounts (empty password) had their mailbox proven by Google; ADMIN and
-- ENGINEER accounts were provisioned by the operator.
UPDATE users SET email_verified = true WHERE password = '' OR role IN ('ADMIN', 'ENGINEER');
