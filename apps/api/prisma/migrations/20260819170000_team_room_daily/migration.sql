ALTER TYPE "RoomType" ADD VALUE 'TEAM';

CREATE TYPE "TeamAvailability" AS ENUM ('AVAILABLE', 'FOCUS', 'BUSY', 'AWAY', 'BREAK');
CREATE TYPE "TeamZone" AS ENUM ('TEAM_ROOM', 'DAILY_ROOM', 'PLANNING_ROOM', 'RETROSPECTIVE_ROOM', 'COFFEE_AREA');
CREATE TYPE "DailyMode" AS ENUM ('SYNCHRONOUS', 'ASYNCHRONOUS', 'HYBRID');
CREATE TYPE "DailyStatus" AS ENUM ('OPEN', 'ACTIVE', 'COMPLETED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastLoginAt" TIMESTAMP(3),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Room" ADD COLUMN "ownerUserId" TEXT;

ALTER TABLE "Participant"
ADD COLUMN "availability" "TeamAvailability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN "zone" "TeamZone" NOT NULL DEFAULT 'TEAM_ROOM',
ADD COLUMN "activity" TEXT,
ADD COLUMN "userId" TEXT;

CREATE TABLE "DailySession" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "mode" "DailyMode" NOT NULL DEFAULT 'HYBRID',
  "status" "DailyStatus" NOT NULL DEFAULT 'OPEN',
  "currentParticipantId" TEXT,
  "currentTurnStartedAt" TIMESTAMP(3),
  "turnDurationSeconds" INTEGER NOT NULL DEFAULT 120,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyEntry" (
  "id" TEXT NOT NULL,
  "dailyId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "yesterday" TEXT NOT NULL DEFAULT '',
  "today" TEXT NOT NULL DEFAULT '',
  "mood" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyBlocker" (
  "id" TEXT NOT NULL,
  "dailyId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyBlocker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyAction" (
  "id" TEXT NOT NULL,
  "dailyId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "assigneeName" TEXT,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailySession_roomId_date_key" ON "DailySession"("roomId", "date");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");
CREATE INDEX "Room_ownerUserId_idx" ON "Room"("ownerUserId");
CREATE INDEX "Participant_userId_idx" ON "Participant"("userId");
CREATE INDEX "DailySession_roomId_status_date_idx" ON "DailySession"("roomId", "status", "date");
CREATE UNIQUE INDEX "DailyEntry_dailyId_participantId_key" ON "DailyEntry"("dailyId", "participantId");
CREATE INDEX "DailyEntry_participantId_submittedAt_idx" ON "DailyEntry"("participantId", "submittedAt");
CREATE INDEX "DailyBlocker_dailyId_resolvedAt_idx" ON "DailyBlocker"("dailyId", "resolvedAt");
CREATE INDEX "DailyBlocker_participantId_createdAt_idx" ON "DailyBlocker"("participantId", "createdAt");
CREATE INDEX "DailyAction_dailyId_completed_idx" ON "DailyAction"("dailyId", "completed");

ALTER TABLE "DailySession" ADD CONSTRAINT "DailySession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyEntry" ADD CONSTRAINT "DailyEntry_dailyId_fkey" FOREIGN KEY ("dailyId") REFERENCES "DailySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyEntry" ADD CONSTRAINT "DailyEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyBlocker" ADD CONSTRAINT "DailyBlocker_dailyId_fkey" FOREIGN KEY ("dailyId") REFERENCES "DailySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyBlocker" ADD CONSTRAINT "DailyBlocker_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyAction" ADD CONSTRAINT "DailyAction_dailyId_fkey" FOREIGN KEY ("dailyId") REFERENCES "DailySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyAction" ADD CONSTRAINT "DailyAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
