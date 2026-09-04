CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "instagramUrl" TEXT,
    "spotifyUrl" TEXT,
    "bio" TEXT,
    "genre" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventArtist" (
    "eventId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventArtist_pkey" PRIMARY KEY ("eventId", "artistId")
);

CREATE INDEX "Artist_stageName_idx" ON "Artist"("stageName");
CREATE INDEX "Artist_createdById_idx" ON "Artist"("createdById");
CREATE INDEX "EventArtist_eventId_position_idx" ON "EventArtist"("eventId", "position");
CREATE INDEX "EventArtist_artistId_idx" ON "EventArtist"("artistId");
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventArtist" ADD CONSTRAINT "EventArtist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventArtist" ADD CONSTRAINT "EventArtist_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
