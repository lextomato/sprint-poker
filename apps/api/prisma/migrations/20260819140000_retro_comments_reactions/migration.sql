CREATE TABLE "RetroComment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetroComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RetroReaction" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetroReaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RetroComment_cardId_createdAt_idx" ON "RetroComment"("cardId", "createdAt");
CREATE INDEX "RetroComment_participantId_idx" ON "RetroComment"("participantId");
CREATE UNIQUE INDEX "RetroReaction_cardId_participantId_emoji_key" ON "RetroReaction"("cardId", "participantId", "emoji");
CREATE INDEX "RetroReaction_cardId_idx" ON "RetroReaction"("cardId");
CREATE INDEX "RetroReaction_participantId_idx" ON "RetroReaction"("participantId");

ALTER TABLE "RetroComment" ADD CONSTRAINT "RetroComment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "RetroCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroComment" ADD CONSTRAINT "RetroComment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroReaction" ADD CONSTRAINT "RetroReaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "RetroCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RetroReaction" ADD CONSTRAINT "RetroReaction_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
