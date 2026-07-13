import { ConfigService } from "@nestjs/config";
import { RoomStatus } from "@prisma/client";
import { RoomsService } from "./rooms.service";
import type { PrismaService } from "../database/prisma.service";

describe("RoomsService state visibility", () => {
  const room = {
    id: "room-1",
    code: "ROOM1234",
    name: "Planning",
    status: RoomStatus.VOTING,
    deck: "FIBONACCI",
    activeStoryId: "story-1",
    currentRound: 1,
    moderatorParticipantId: "p1",
    revealConfig: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActivityAt: new Date(),
    closedAt: null
  };
  const participant = {
    id: "p1",
    roomId: "room-1",
    displayName: "Ada",
    sessionToken: "token",
    role: "VOTER",
    connected: true,
    removedAt: null,
    joinedAt: new Date(),
    lastActivityAt: new Date()
  };
  const story = {
    id: "story-1",
    roomId: "room-1",
    title: "Estimate checkout",
    description: null,
    acceptanceCriteria: null,
    position: 1,
    status: "ACTIVE",
    finalEstimate: null,
    source: null,
    externalId: null,
    ownerName: null,
    workflowStatus: null,
    taskType: null,
    originalEstimate: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const round = {
    id: "round-1",
    roomId: "room-1",
    storyId: "story-1",
    number: 1,
    revealedAt: null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const vote = {
    id: "vote-1",
    roomId: "room-1",
    storyId: "story-1",
    participantId: "p1",
    roundId: "round-1",
    value: "8",
    createdAt: new Date(),
    updatedAt: new Date()
  };

  function buildService(status: RoomStatus) {
    const prisma = {
      room: { findUnique: jest.fn().mockResolvedValue({ ...room, status }) },
      participant: { findMany: jest.fn().mockResolvedValue([participant]) },
      story: { findMany: jest.fn().mockResolvedValue([story]) },
      chatMessage: { findMany: jest.fn().mockResolvedValue([]) },
      avatarReaction: { findMany: jest.fn().mockResolvedValue([]) },
      estimationRound: { findFirst: jest.fn().mockResolvedValue(round), findMany: jest.fn().mockResolvedValue([]) },
      vote: { findMany: jest.fn().mockResolvedValue([vote]) }
    } as unknown as PrismaService;
    return new RoomsService(prisma, { get: jest.fn() } as unknown as ConfigService);
  }

  it("does not expose vote values before reveal", async () => {
    const state = await buildService(RoomStatus.VOTING).getRoomState("ROOM1234", "p1");
    expect(state.votes).toEqual([{ participantId: "p1", hasVoted: true, timestamp: vote.updatedAt.toISOString() }]);
    expect(state.statistics).toBeNull();
  });

  it("exposes values and statistics after reveal", async () => {
    const state = await buildService(RoomStatus.REVEALED).getRoomState("ROOM1234", "p1");
    expect(state.votes[0]).toMatchObject({ participantId: "p1", value: "8" });
    expect(state.statistics?.average).toBe(8);
  });
});
