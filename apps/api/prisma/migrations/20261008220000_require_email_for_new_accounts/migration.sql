-- Existing accounts keep their current access. Only accounts created by the
-- updated registration code opt in to mandatory verification.
ALTER TABLE "User" ADD COLUMN "emailVerificationRequired" BOOLEAN NOT NULL DEFAULT false;
