ALTER TABLE "Event"
ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "inviteTokenHash" TEXT;

CREATE UNIQUE INDEX "Event_inviteTokenHash_key" ON "Event"("inviteTokenHash");
