CREATE TYPE "RoomType" AS ENUM ('PLANNING', 'RETROSPECTIVE');

ALTER TABLE "Room" ADD COLUMN "type" "RoomType" NOT NULL DEFAULT 'PLANNING';

CREATE TABLE "RetroColumn" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "RetroColumn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetroCard" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "participantId" TEXT,
    "content" TEXT NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetroCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetroVote" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetroVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetroAction" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "cardId" TEXT,
    "createdById" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "assigneeName" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetroAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetroColumn_roomId_position_key" ON "RetroColumn"("roomId", "position");
CREATE INDEX "RetroColumn_roomId_idx" ON "RetroColumn"("roomId");
CREATE INDEX "RetroCard_roomId_columnId_position_idx" ON "RetroCard"("roomId", "columnId", "position");
CREATE INDEX "RetroCard_participantId_idx" ON "RetroCard"("participantId");
CREATE UNIQUE INDEX "RetroVote_cardId_participantId_key" ON "RetroVote"("cardId", "participantId");
CREATE INDEX "RetroVote_participantId_idx" ON "RetroVote"("participantId");
CREATE INDEX "RetroAction_roomId_completed_idx" ON "RetroAction"("roomId", "completed");

ALTER TABLE "RetroColumn" ADD CONSTRAINT "RetroColumn_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroCard" ADD CONSTRAINT "RetroCard_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroCard" ADD CONSTRAINT "RetroCard_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "RetroColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroCard" ADD CONSTRAINT "RetroCard_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RetroVote" ADD CONSTRAINT "RetroVote_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "RetroCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroVote" ADD CONSTRAINT "RetroVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroAction" ADD CONSTRAINT "RetroAction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroAction" ADD CONSTRAINT "RetroAction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "RetroCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RetroAction" ADD CONSTRAINT "RetroAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
