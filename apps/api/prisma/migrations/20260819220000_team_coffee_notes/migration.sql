CREATE TABLE "TeamNote" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamNote_roomId_expiresAt_idx" ON "TeamNote"("roomId", "expiresAt");
CREATE INDEX "TeamNote_participantId_createdAt_idx" ON "TeamNote"("participantId", "createdAt");

ALTER TABLE "TeamNote" ADD CONSTRAINT "TeamNote_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamNote" ADD CONSTRAINT "TeamNote_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
