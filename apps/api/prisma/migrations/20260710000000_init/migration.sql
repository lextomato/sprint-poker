CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'VOTING', 'REVEALED', 'CLOSED');
CREATE TYPE "ParticipantRole" AS ENUM ('MODERATOR', 'VOTER', 'OBSERVER');
CREATE TYPE "StoryStatus" AS ENUM ('PENDING', 'ACTIVE', 'ESTIMATED', 'SKIPPED');

CREATE TABLE "Room" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
  "deck" TEXT NOT NULL DEFAULT 'FIBONACCI',
  "activeStoryId" TEXT,
  "currentRound" INTEGER NOT NULL DEFAULT 0,
  "moderatorParticipantId" TEXT,
  "revealConfig" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Participant" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "role" "ParticipantRole" NOT NULL DEFAULT 'VOTER',
  "connected" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Story" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "acceptanceCriteria" TEXT,
  "position" INTEGER NOT NULL,
  "status" "StoryStatus" NOT NULL DEFAULT 'PENDING',
  "finalEstimate" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EstimationRound" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "revealedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EstimationRound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vote" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");
CREATE INDEX "Room_code_idx" ON "Room"("code");
CREATE INDEX "Room_status_idx" ON "Room"("status");
CREATE UNIQUE INDEX "Participant_sessionToken_key" ON "Participant"("sessionToken");
CREATE UNIQUE INDEX "Participant_roomId_displayName_key" ON "Participant"("roomId", "displayName");
CREATE INDEX "Participant_roomId_role_idx" ON "Participant"("roomId", "role");
CREATE UNIQUE INDEX "Story_roomId_position_key" ON "Story"("roomId", "position");
CREATE INDEX "Story_roomId_status_idx" ON "Story"("roomId", "status");
CREATE UNIQUE INDEX "EstimationRound_storyId_number_key" ON "EstimationRound"("storyId", "number");
CREATE INDEX "EstimationRound_roomId_storyId_idx" ON "EstimationRound"("roomId", "storyId");
CREATE UNIQUE INDEX "Vote_participantId_storyId_roundId_key" ON "Vote"("participantId", "storyId", "roundId");
CREATE INDEX "Vote_roomId_storyId_roundId_idx" ON "Vote"("roomId", "storyId", "roundId");

ALTER TABLE "Participant" ADD CONSTRAINT "Participant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Story" ADD CONSTRAINT "Story_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EstimationRound" ADD CONSTRAINT "EstimationRound_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EstimationRound" ADD CONSTRAINT "EstimationRound_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "EstimationRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
