import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ParticipantRole as PrismaParticipantRole, RoomStatus as PrismaRoomStatus, StoryStatus as PrismaStoryStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { read, utils, write } from "xlsx";
import {
  FIBONACCI_DECK,
  AvatarReactionView,
  ChatMessageView,
  ParticipantRole,
  RevealedVoteView,
  RoomStateView,
  RoomStatus,
  SessionSummaryView,
  StoryStatus,
  VoteStatistics,
  calculateVoteStatistics
} from "@planning/shared";
import { PrismaService } from "../database/prisma.service";
import { AppError, ErrorCode } from "../common/app-error";
import { sanitizeOptionalText, sanitizeText } from "../common/sanitize";
import type { CreateRoomDto, CreateStoryDto, JoinRoomDto, ReorderStoriesDto, UpdateStoryDto } from "./dto";

interface ImportedStoryRow {
  title: string;
  originalTitle: string;
  source: string;
  externalId: string | null;
  ownerName: string | null;
  workflowStatus: string | null;
  taskType: string | null;
  originalEstimate: string | null;
}

interface DetectedImport {
  source: string;
  headerRow: number;
  rows: ImportedStoryRow[];
  warnings: string[];
}

interface SummaryExportRow {
  roomCode: string;
  roomName: string;
  storyTitle: string;
  owner: string;
  workflowStatus: string;
  taskType: string;
  originalEstimate: string;
  finalEstimate: string;
  storyStatus: string;
  round: string;
  participant: string;
  vote: string;
  average: string;
  median: string;
  mode: string;
  min: string;
  max: string;
  consensus: string;
}

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async createRoom(dto: CreateRoomDto) {
    const code = await this.generateRoomCode();
    const sessionToken = this.generateSessionToken();
    const room = await this.prisma.room.create({
      data: {
        code,
        name: sanitizeText(dto.roomName),
        participants: {
          create: {
            displayName: sanitizeText(dto.participantName),
            role: PrismaParticipantRole.MODERATOR,
            sessionToken,
            connected: true
          }
        }
      },
      include: { participants: true }
    });
    const moderator = room.participants[0];
    await this.prisma.room.update({
      where: { id: room.id },
      data: { moderatorParticipantId: moderator.id }
    });
    if (dto.firstStoryTitle?.trim()) {
      await this.prisma.story.create({
        data: {
          roomId: room.id,
          title: sanitizeText(dto.firstStoryTitle),
          position: 1
        }
      });
    }
    this.logger.log({ event: "room.created", roomCode: code, participantId: moderator.id });
    return { roomCode: code, sessionToken, participantId: moderator.id, state: await this.getRoomState(code, moderator.id) };
  }

  async getPublicRoom(roomCode: string) {
    const room = await this.findRoom(roomCode);
    return { code: room.code, name: room.name, status: room.status, activeStoryId: room.activeStoryId };
  }

  async joinRoom(roomCode: string, dto: JoinRoomDto) {
    const room = await this.findRoom(roomCode);
    this.ensureRoomOpen(room.status);
    const displayName = sanitizeText(dto.participantName);
    const duplicate = await this.prisma.participant.findFirst({ where: { roomId: room.id, displayName, removedAt: null } });
    if (duplicate) {
      throw new AppError(ErrorCode.DUPLICATE_PARTICIPANT_NAME, "Ya existe un participante con ese nombre en la sala.");
    }
    const sessionToken = this.generateSessionToken();
    const participant = await this.prisma.participant.create({
      data: {
        roomId: room.id,
        displayName,
        sessionToken,
        role: this.toPrismaRole(dto.role ?? ParticipantRole.VOTER),
        connected: true
      }
    });
    await this.touchRoom(room.id);
    return { roomCode, sessionToken, participantId: participant.id, state: await this.getRoomState(roomCode, participant.id) };
  }

  async reconnect(roomCode: string, sessionToken: string) {
    const room = await this.findRoom(roomCode);
    const participant = await this.prisma.participant.findFirst({ where: { roomId: room.id, sessionToken, removedAt: null } });
    if (!participant) {
      throw new AppError(ErrorCode.INVALID_SESSION, "No se pudo recuperar la sesion.");
    }
    await this.prisma.participant.update({
      where: { id: participant.id },
      data: { connected: true, lastActivityAt: new Date() }
    });
    await this.touchRoom(room.id);
    return { roomCode, sessionToken, participantId: participant.id, state: await this.getRoomState(roomCode, participant.id) };
  }

  async disconnectParticipant(participantId: string) {
    await this.prisma.participant
      .update({ where: { id: participantId }, data: { connected: false, lastActivityAt: new Date() } })
      .catch(() => undefined);
  }

  async validateParticipantSession(roomCode: string, sessionToken: string, options: { allowClosed?: boolean } = {}) {
    return this.requireParticipant(roomCode, sessionToken, options);
  }

  async getRoomState(roomCode: string, viewerParticipantId?: string): Promise<RoomStateView> {
    const room = await this.findRoom(roomCode);
    const participants = await this.prisma.participant.findMany({ where: { roomId: room.id, removedAt: null }, orderBy: { joinedAt: "asc" } });
    const stories = await this.prisma.story.findMany({ where: { roomId: room.id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
    const chatMessages = await this.prisma.chatMessage.findMany({
      where: { roomId: room.id },
      include: { participant: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    const reactions = await this.prisma.avatarReaction.findMany({
      where: { roomId: room.id },
      include: { participant: true },
      orderBy: { createdAt: "desc" },
      take: 24
    });
    const activeRound = await this.getActiveRound(room.id, room.activeStoryId, room.currentRound);
    const votes = activeRound ? await this.prisma.vote.findMany({ where: { roundId: activeRound.id }, orderBy: { createdAt: "asc" } }) : [];
    const revealValues = room.status === PrismaRoomStatus.REVEALED;
    const voteViews = votes.map((vote) => {
      const base = { participantId: vote.participantId, hasVoted: true, timestamp: vote.updatedAt.toISOString() };
      return revealValues ? { ...base, value: vote.value } : base;
    });
    const history = await this.getHistory(roomCode);
    const me = viewerParticipantId ? participants.find((participant) => participant.id === viewerParticipantId) : undefined;
    return {
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        status: room.status as RoomStatus,
        deck: [...FIBONACCI_DECK],
        activeStoryId: room.activeStoryId,
        currentRound: room.currentRound,
        moderatorParticipantId: room.moderatorParticipantId,
        lastActivityAt: room.lastActivityAt.toISOString()
      },
      me: me
        ? {
            id: me.id,
            displayName: me.displayName,
            role: me.role as ParticipantRole,
            connected: me.connected,
            hasVoted: votes.some((vote) => vote.participantId === me.id),
            joinedAt: me.joinedAt.toISOString(),
            lastActivityAt: me.lastActivityAt.toISOString()
          }
        : undefined,
      participants: participants.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        role: participant.role as ParticipantRole,
        connected: participant.connected,
        hasVoted: votes.some((vote) => vote.participantId === participant.id),
        joinedAt: participant.joinedAt.toISOString(),
        lastActivityAt: participant.lastActivityAt.toISOString()
      })),
      stories: stories.map((story) => ({
        id: story.id,
        title: story.title,
        description: story.description,
        acceptanceCriteria: story.acceptanceCriteria,
        position: story.position,
        status: story.status as StoryStatus,
        finalEstimate: story.finalEstimate,
        source: story.source,
        externalId: story.externalId,
        ownerName: story.ownerName,
        workflowStatus: story.workflowStatus,
        taskType: story.taskType,
        originalEstimate: story.originalEstimate
      })),
      votes: voteViews,
      chatMessages: chatMessages
        .slice()
        .reverse()
        .map((message): ChatMessageView => ({
          id: message.id,
          participantId: message.participantId,
          participantName: message.participant.displayName,
          participantRole: message.participant.role as ParticipantRole,
          content: message.content,
          gifUrl: message.gifUrl,
          gifTitle: message.gifTitle,
          createdAt: message.createdAt.toISOString()
        })),
      reactions: reactions
        .slice()
        .reverse()
        .map((reaction): AvatarReactionView => ({
          id: reaction.id,
          participantId: reaction.participantId,
          participantName: reaction.participant.displayName,
          emoji: reaction.emoji,
          createdAt: reaction.createdAt.toISOString()
        })),
      statistics: revealValues ? calculateVoteStatistics(votes.map((vote) => vote.value)) : null,
      history
    };
  }

  async getStories(roomCode: string) {
    const room = await this.findRoom(roomCode);
    return this.prisma.story.findMany({ where: { roomId: room.id }, orderBy: { position: "asc" } });
  }

  async createStory(roomCode: string, sessionToken: string, dto: CreateStoryDto) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken);
    const max = await this.prisma.story.aggregate({ where: { roomId: room.id }, _max: { position: true } });
    const story = await this.prisma.story.create({
      data: {
        roomId: room.id,
        title: sanitizeText(dto.title),
        description: sanitizeOptionalText(dto.description),
        acceptanceCriteria: sanitizeOptionalText(dto.acceptanceCriteria),
        position: (max._max.position ?? 0) + 1
      }
    });
    await this.touch(room.id, participant.id);
    return story;
  }

  async importStories(roomCode: string, sessionToken: string, fileName: string, buffer: Buffer) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken);
    const detected = this.detectStoriesFromWorkbook(fileName, buffer);
    if (detected.rows.length === 0) {
      throw new AppError(ErrorCode.INVALID_IMPORT, "No se encontraron filas de tipo HDU para importar.");
    }

    const existingStories = await this.prisma.story.findMany({ where: { roomId: room.id }, select: { title: true } });
    const existingTitles = new Set(existingStories.map((story) => this.normalizeHeader(story.title)));
    const uniqueRows = detected.rows.filter((row) => !existingTitles.has(this.normalizeHeader(row.title)));
    const skippedDuplicates = detected.rows.length - uniqueRows.length;
    const max = await this.prisma.story.aggregate({ where: { roomId: room.id }, _max: { position: true } });
    const startingPosition = max._max.position ?? 0;

    await this.prisma.$transaction(
      uniqueRows.map((row, index) =>
        this.prisma.story.create({
          data: {
            roomId: room.id,
            title: sanitizeText(row.title),
            description: this.buildImportedDescription(row),
            position: startingPosition + index + 1,
            source: row.source,
            externalId: row.externalId,
            ownerName: row.ownerName,
            workflowStatus: row.workflowStatus,
            taskType: row.taskType,
            originalEstimate: row.originalEstimate
          }
        })
      )
    );
    await this.touch(room.id, participant.id);
    return {
      imported: uniqueRows.length,
      skipped: detected.warnings.length + skippedDuplicates,
      detectedSource: detected.source,
      headerRow: detected.headerRow,
      stories: await this.getStories(roomCode),
      warnings: [...detected.warnings, ...(skippedDuplicates ? [`${skippedDuplicates} historia(s) duplicada(s) fueron omitidas.`] : [])]
    };
  }

  async updateParticipantRole(roomCode: string, targetParticipantId: string, sessionToken: string, role: "VOTER" | "OBSERVER") {
    const { room, participant: moderator } = await this.requireModerator(roomCode, sessionToken);
    if (targetParticipantId === moderator.id) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "El moderador no puede cambiar su propio rol.");
    }
    const target = await this.ensureParticipant(room.id, targetParticipantId);
    if (target.role === PrismaParticipantRole.MODERATOR) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "No se puede modificar el rol del moderador.");
    }
    const updated = await this.prisma.participant.update({
      where: { id: target.id },
      data: { role: role === ParticipantRole.OBSERVER ? PrismaParticipantRole.OBSERVER : PrismaParticipantRole.VOTER, lastActivityAt: new Date() }
    });
    if (updated.role === PrismaParticipantRole.OBSERVER && room.activeStoryId) {
      const round = await this.getActiveRound(room.id, room.activeStoryId, room.currentRound);
      if (round) {
        await this.prisma.vote.deleteMany({ where: { participantId: updated.id, roundId: round.id } });
      }
    }
    await this.touch(room.id, moderator.id);
    return this.getRoomState(roomCode, moderator.id);
  }

  async removeParticipant(roomCode: string, targetParticipantId: string, sessionToken: string) {
    const { room, participant: moderator } = await this.requireModerator(roomCode, sessionToken);
    if (targetParticipantId === moderator.id) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "El moderador no puede expulsarse a si mismo.");
    }
    const target = await this.ensureParticipant(room.id, targetParticipantId);
    if (target.role === PrismaParticipantRole.MODERATOR) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "No se puede expulsar al moderador.");
    }
    await this.prisma.participant.update({
      where: { id: target.id },
      data: { connected: false, removedAt: new Date(), lastActivityAt: new Date() }
    });
    await this.touch(room.id, moderator.id);
    return this.getRoomState(roomCode, moderator.id);
  }

  async updateStory(roomCode: string, storyId: string, sessionToken: string, dto: UpdateStoryDto) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken);
    await this.ensureStory(room.id, storyId);
    const story = await this.prisma.story.update({
      where: { id: storyId },
      data: {
        title: dto.title ? sanitizeText(dto.title) : undefined,
        description: dto.description !== undefined ? sanitizeOptionalText(dto.description) : undefined,
        acceptanceCriteria: dto.acceptanceCriteria !== undefined ? sanitizeOptionalText(dto.acceptanceCriteria) : undefined
      }
    });
    await this.touch(room.id, participant.id);
    return story;
  }

  async deleteStory(roomCode: string, storyId: string, sessionToken: string) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken);
    const story = await this.ensureStory(room.id, storyId);
    if (story.finalEstimate) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "No se elimina una historia estimada desde el MVP sin confirmacion explicita.");
    }
    await this.prisma.story.delete({ where: { id: storyId } });
    if (room.activeStoryId === storyId) {
      await this.prisma.room.update({ where: { id: room.id }, data: { activeStoryId: null, status: PrismaRoomStatus.WAITING } });
    }
    await this.touch(room.id, participant.id);
    return { deleted: true };
  }

  async reorderStories(roomCode: string, sessionToken: string, dto: ReorderStoriesDto) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken);
    await this.prisma.$transaction(async (tx) => {
      for (let index = 0; index < dto.storyIds.length; index += 1) {
        await tx.story.update({ where: { id: dto.storyIds[index] }, data: { position: -1000 - index } });
      }
      for (let index = 0; index < dto.storyIds.length; index += 1) {
        await tx.story.update({ where: { id: dto.storyIds[index] }, data: { position: index + 1 } });
      }
    });
    await this.touch(room.id, participant.id);
    return this.getStories(roomCode);
  }

  async activateStory(roomCode: string, storyId: string, sessionToken: string) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken);
    await this.ensureStory(room.id, storyId);
    const nextRound = room.activeStoryId === storyId ? room.currentRound + 1 : 1;
    await this.prisma.$transaction([
      this.prisma.story.updateMany({ where: { roomId: room.id, status: PrismaStoryStatus.ACTIVE }, data: { status: PrismaStoryStatus.PENDING } }),
      this.prisma.story.update({ where: { id: storyId }, data: { status: PrismaStoryStatus.ACTIVE } }),
      this.prisma.estimationRound.upsert({
        where: { storyId_number: { storyId, number: nextRound } },
        create: { roomId: room.id, storyId, number: nextRound },
        update: { revealedAt: null, closedAt: null }
      }),
      this.prisma.room.update({
        where: { id: room.id },
        data: { activeStoryId: storyId, currentRound: nextRound, status: PrismaRoomStatus.VOTING, lastActivityAt: new Date() }
      })
    ]);
    await this.touch(room.id, participant.id);
    return this.getRoomState(roomCode, participant.id);
  }

  async skipStory(roomCode: string, storyId: string, sessionToken: string) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken);
    await this.ensureStory(room.id, storyId);
    await this.prisma.story.update({ where: { id: storyId }, data: { status: PrismaStoryStatus.SKIPPED } });
    await this.touch(room.id, participant.id);
    return this.getRoomState(roomCode, participant.id);
  }

  async submitVote(roomCode: string, sessionToken: string, value: string) {
    const { room, participant } = await this.requireParticipant(roomCode, sessionToken);
    if (participant.role === PrismaParticipantRole.OBSERVER) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Los observadores no pueden votar.");
    }
    if (room.status !== PrismaRoomStatus.VOTING || !room.activeStoryId) {
      throw new AppError(ErrorCode.VOTING_NOT_ACTIVE, "La votacion no esta activa.");
    }
    if (!FIBONACCI_DECK.includes(value as (typeof FIBONACCI_DECK)[number])) {
      throw new AppError(ErrorCode.INVALID_VOTE, "La carta seleccionada no pertenece a la baraja activa.");
    }
    const round = await this.getActiveRoundOrThrow(room.id, room.activeStoryId, room.currentRound);
    await this.prisma.vote.upsert({
      where: { participantId_storyId_roundId: { participantId: participant.id, storyId: room.activeStoryId, roundId: round.id } },
      create: { roomId: room.id, storyId: room.activeStoryId, participantId: participant.id, roundId: round.id, value },
      update: { value }
    });
    await this.touch(room.id, participant.id);
    return this.getRoomState(roomCode, participant.id);
  }

  async clearVote(roomCode: string, sessionToken: string) {
    const { room, participant } = await this.requireParticipant(roomCode, sessionToken);
    if (!room.activeStoryId) {
      throw new AppError(ErrorCode.NO_ACTIVE_STORY, "No hay historia activa.");
    }
    const round = await this.getActiveRoundOrThrow(room.id, room.activeStoryId, room.currentRound);
    await this.prisma.vote.deleteMany({ where: { participantId: participant.id, storyId: room.activeStoryId, roundId: round.id } });
    await this.touch(room.id, participant.id);
    return this.getRoomState(roomCode, participant.id);
  }

  async revealRound(roomCode: string, sessionToken: string) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken);
    if (!room.activeStoryId) {
      throw new AppError(ErrorCode.NO_ACTIVE_STORY, "No hay historia activa.");
    }
    const round = await this.getActiveRoundOrThrow(room.id, room.activeStoryId, room.currentRound);
    await this.prisma.estimationRound.update({ where: { id: round.id }, data: { revealedAt: new Date() } });
    await this.prisma.room.update({ where: { id: room.id }, data: { status: PrismaRoomStatus.REVEALED, lastActivityAt: new Date() } });
    await this.touch(room.id, participant.id);
    return this.getRoomState(roomCode, participant.id);
  }

  async restartRound(roomCode: string, sessionToken: string) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken);
    if (!room.activeStoryId) {
      throw new AppError(ErrorCode.NO_ACTIVE_STORY, "No hay historia activa.");
    }
    const nextRound = room.currentRound + 1;
    await this.prisma.$transaction([
      this.prisma.estimationRound.create({ data: { roomId: room.id, storyId: room.activeStoryId, number: nextRound } }),
      this.prisma.room.update({ where: { id: room.id }, data: { currentRound: nextRound, status: PrismaRoomStatus.VOTING, lastActivityAt: new Date() } })
    ]);
    await this.touch(room.id, participant.id);
    return this.getRoomState(roomCode, participant.id);
  }

  async finalizeStory(roomCode: string, storyId: string, sessionToken: string, finalEstimate: string) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken);
    const story = await this.ensureStory(room.id, storyId);
    const round = await this.getActiveRound(room.id, storyId, room.currentRound);
    const nextStory =
      (await this.prisma.story.findFirst({
        where: { roomId: room.id, id: { not: storyId }, status: PrismaStoryStatus.PENDING, position: { gt: story.position } },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      })) ??
      (await this.prisma.story.findFirst({
        where: { roomId: room.id, id: { not: storyId }, status: PrismaStoryStatus.PENDING },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }]
      }));

    await this.prisma.$transaction([
      ...(round ? [this.prisma.estimationRound.update({ where: { id: round.id }, data: { closedAt: new Date() } })] : []),
      this.prisma.story.update({ where: { id: storyId }, data: { status: PrismaStoryStatus.ESTIMATED, finalEstimate } }),
      ...(nextStory
        ? [
            this.prisma.story.updateMany({ where: { roomId: room.id, status: PrismaStoryStatus.ACTIVE }, data: { status: PrismaStoryStatus.PENDING } }),
            this.prisma.story.update({ where: { id: nextStory.id }, data: { status: PrismaStoryStatus.ACTIVE } }),
            this.prisma.estimationRound.upsert({
              where: { storyId_number: { storyId: nextStory.id, number: 1 } },
              create: { roomId: room.id, storyId: nextStory.id, number: 1 },
              update: { revealedAt: null, closedAt: null }
            }),
            this.prisma.room.update({ where: { id: room.id }, data: { status: PrismaRoomStatus.VOTING, activeStoryId: nextStory.id, currentRound: 1, lastActivityAt: new Date() } })
          ]
        : [this.prisma.room.update({ where: { id: room.id }, data: { status: PrismaRoomStatus.WAITING, activeStoryId: null, lastActivityAt: new Date() } })])
    ]);
    await this.touch(room.id, participant.id);
    return this.getRoomState(roomCode, participant.id);
  }

  async closeRoom(roomCode: string, sessionToken: string) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken);
    await this.prisma.room.update({ where: { id: room.id }, data: { status: PrismaRoomStatus.CLOSED, closedAt: new Date() } });
    await this.touch(room.id, participant.id);
    return { closed: true, summary: await this.getSessionSummary(roomCode, sessionToken) };
  }

  async reopenRoom(roomCode: string, sessionToken: string) {
    const { room, participant } = await this.requireModerator(roomCode, sessionToken, { allowClosed: true });
    if (room.status !== PrismaRoomStatus.CLOSED) {
      return this.getRoomState(roomCode, participant.id);
    }
    await this.prisma.$transaction([
      this.prisma.story.updateMany({ where: { roomId: room.id, status: PrismaStoryStatus.ACTIVE }, data: { status: PrismaStoryStatus.PENDING } }),
      this.prisma.room.update({
        where: { id: room.id },
        data: { status: PrismaRoomStatus.WAITING, closedAt: null, activeStoryId: null, lastActivityAt: new Date() }
      })
    ]);
    await this.touch(room.id, participant.id);
    return this.getRoomState(roomCode, participant.id);
  }

  async sendChatMessage(roomCode: string, sessionToken: string, payload: { content?: string | null; gifUrl?: string | null; gifTitle?: string | null }) {
    const { room, participant } = await this.requireParticipant(roomCode, sessionToken);
    await this.prisma.chatMessage.create({
      data: {
        roomId: room.id,
        participantId: participant.id,
        content: sanitizeOptionalText(payload.content)?.slice(0, 500) ?? null,
        gifUrl: sanitizeOptionalText(payload.gifUrl)?.slice(0, 1000) ?? null,
        gifTitle: sanitizeOptionalText(payload.gifTitle)?.slice(0, 120) ?? null
      }
    });
    await this.touch(room.id, participant.id);
    return this.getRoomState(roomCode, participant.id);
  }

  async sendReaction(roomCode: string, sessionToken: string, emoji: string) {
    const { room, participant } = await this.requireParticipant(roomCode, sessionToken);
    await this.prisma.avatarReaction.create({
      data: {
        roomId: room.id,
        participantId: participant.id,
        emoji: sanitizeText(emoji).slice(0, 12)
      }
    });
    await this.touch(room.id, participant.id);
    return this.getRoomState(roomCode, participant.id);
  }

  async getSessionSummary(roomCode: string, sessionToken: string): Promise<SessionSummaryView> {
    const { room } = await this.requireParticipant(roomCode, sessionToken, { allowClosed: true });
    const participants = await this.prisma.participant.findMany({ where: { roomId: room.id }, orderBy: { joinedAt: "asc" } });
    const stories = await this.prisma.story.findMany({
      where: { roomId: room.id },
      include: {
        rounds: {
          include: { votes: { include: { participant: true }, orderBy: { createdAt: "asc" } } },
          orderBy: { number: "asc" }
        }
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }]
    });
    const allRounds = stories.flatMap((story) => story.rounds);
    const allVotes = allRounds.flatMap((round) => round.votes);

    return {
      room: {
        code: room.code,
        name: room.name,
        status: room.status as RoomStatus,
        createdAt: room.createdAt.toISOString(),
        closedAt: room.closedAt?.toISOString() ?? null
      },
      participants: participants.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        role: participant.role as ParticipantRole,
        connected: participant.connected,
        hasVoted: allVotes.some((vote) => vote.participantId === participant.id),
        joinedAt: participant.joinedAt.toISOString(),
        lastActivityAt: participant.lastActivityAt.toISOString()
      })),
      stories: stories.map((story) => ({
        id: story.id,
        title: story.title,
        status: story.status as StoryStatus,
        finalEstimate: story.finalEstimate,
        ownerName: story.ownerName,
        workflowStatus: story.workflowStatus,
        taskType: story.taskType,
        originalEstimate: story.originalEstimate,
        rounds: story.rounds.map((round) => {
          const revealValues = room.status === PrismaRoomStatus.CLOSED || Boolean(round.revealedAt) || Boolean(round.closedAt);
          const values = revealValues ? round.votes.map((vote) => vote.value) : [];
          return {
            storyId: story.id,
            storyTitle: story.title,
            round: round.number,
            revealedAt: round.revealedAt?.toISOString() ?? null,
            closedAt: round.closedAt?.toISOString() ?? null,
            votes: revealValues
              ? round.votes.map((vote) => ({
                  participantId: vote.participantId,
                  participantName: vote.participant.displayName,
                  value: vote.value,
                  submittedAt: vote.updatedAt.toISOString()
                }))
              : [],
            statistics: revealValues ? calculateVoteStatistics(values) : null
          };
        })
      })),
      totals: {
        participants: participants.length,
        voters: participants.filter((participant) => participant.role === PrismaParticipantRole.VOTER || participant.role === PrismaParticipantRole.MODERATOR).length,
        observers: participants.filter((participant) => participant.role === PrismaParticipantRole.OBSERVER).length,
        stories: stories.length,
        estimatedStories: stories.filter((story) => story.status === PrismaStoryStatus.ESTIMATED).length,
        rounds: allRounds.length,
        votes: allVotes.length
      }
    };
  }

  async exportSessionSummary(roomCode: string, sessionToken: string, format: "csv" | "xlsx") {
    const summary = await this.getSessionSummary(roomCode, sessionToken);
    const rows = this.summaryExportRows(summary);
    if (format === "csv") {
      const headers = Object.keys(rows[0] ?? this.emptySummaryExportRow());
      const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => this.csvEscape(String(row[header as keyof SummaryExportRow] ?? ""))).join(","))].join("\n");
      return { fileName: `planning-summary-${summary.room.code}.csv`, contentType: "text/csv; charset=utf-8", body: Buffer.from(csv, "utf8") };
    }
    const workbook = utils.book_new();
    const worksheet = utils.json_to_sheet(rows);
    utils.book_append_sheet(workbook, worksheet, "Session Summary");
    const body = write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return {
      fileName: `planning-summary-${summary.room.code}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body
    };
  }

  async getHistory(roomCode: string) {
    const room = await this.findRoom(roomCode);
    const rounds = await this.prisma.estimationRound.findMany({
      where: { roomId: room.id, OR: [{ revealedAt: { not: null } }, { closedAt: { not: null } }] },
      include: { story: true, votes: true },
      orderBy: [{ createdAt: "asc" }]
    });
    return rounds.map((round) => {
      const votes: RevealedVoteView[] = round.votes.map((vote) => ({
        participantId: vote.participantId,
        hasVoted: true,
        timestamp: vote.updatedAt.toISOString(),
        value: vote.value
      }));
      const statistics: VoteStatistics | null = round.revealedAt ? calculateVoteStatistics(round.votes.map((vote) => vote.value)) : null;
      return {
        storyId: round.storyId,
        storyTitle: round.story.title,
        round: round.number,
        finalEstimate: round.story.finalEstimate,
        revealedAt: round.revealedAt?.toISOString() ?? null,
        votes,
        statistics
      };
    });
  }

  private async findRoom(roomCode: string) {
    const room = await this.prisma.room.findUnique({ where: { code: roomCode.toUpperCase() } });
    if (!room) {
      throw new AppError(ErrorCode.ROOM_NOT_FOUND, "La sala solicitada no existe.");
    }
    return room;
  }

  private ensureRoomOpen(status: PrismaRoomStatus) {
    if (status === PrismaRoomStatus.CLOSED) {
      throw new AppError(ErrorCode.ROOM_CLOSED, "La sala esta cerrada.");
    }
  }

  private async requireParticipant(roomCode: string, sessionToken: string, options: { allowClosed?: boolean } = {}) {
    const room = await this.findRoom(roomCode);
    if (!options.allowClosed) {
      this.ensureRoomOpen(room.status);
    }
    const participant = await this.prisma.participant.findFirst({ where: { roomId: room.id, sessionToken, removedAt: null } });
    if (!participant) {
      throw new AppError(ErrorCode.INVALID_SESSION, "Sesion invalida para esta sala.");
    }
    return { room, participant };
  }

  private async requireModerator(roomCode: string, sessionToken: string, options: { allowClosed?: boolean } = {}) {
    const context = await this.requireParticipant(roomCode, sessionToken, options);
    if (context.participant.role !== PrismaParticipantRole.MODERATOR || context.room.moderatorParticipantId !== context.participant.id) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Solo el moderador puede realizar esta accion.");
    }
    return context;
  }

  private async ensureStory(roomId: string, storyId: string) {
    const story = await this.prisma.story.findFirst({ where: { id: storyId, roomId } });
    if (!story) {
      throw new AppError(ErrorCode.STORY_NOT_FOUND, "La historia no existe.");
    }
    return story;
  }

  private async ensureParticipant(roomId: string, participantId: string) {
    const participant = await this.prisma.participant.findFirst({ where: { id: participantId, roomId, removedAt: null } });
    if (!participant) {
      throw new AppError(ErrorCode.PARTICIPANT_NOT_FOUND, "El participante no existe en la sala.");
    }
    return participant;
  }

  private detectStoriesFromWorkbook(fileName: string, buffer: Buffer): DetectedImport {
    const workbook = read(buffer, { type: "buffer", cellDates: true });
    const warnings: string[] = [];
    let source = this.detectImportSource(fileName, workbook.SheetNames);
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const matrix = utils.sheet_to_json<Array<string | number | Date | null>>(sheet, { header: 1, defval: null, raw: false });
      if (matrix.slice(0, 5).some((row) => row.some((cell) => this.normalizeHeader(String(cell ?? "")).includes("monday com")))) {
        source = "monday.com";
      }
      const headerIndex = matrix.findIndex((row) => this.findColumn(row, ["name", "nombre", "title", "titulo", "título", "historia", "hdu"]) !== -1);
      if (headerIndex === -1) {
        continue;
      }
      const headers = matrix[headerIndex].map((cell) => this.normalizeHeader(String(cell ?? "")));
      const titleIndex = this.findColumn(headers, ["name", "nombre", "title", "titulo", "título", "historia", "hdu"]);
      const ownerIndex = this.findColumn(headers, ["dueño", "dueno", "owner", "responsable", "assignee"]);
      const statusIndex = this.findColumn(headers, ["estado desarrollo", "estado", "status"]);
      const typeIndex = this.findColumn(headers, ["tipo tarea", "tipo", "type", "task type"]);
      const estimateIndex = this.findColumn(headers, ["estimación original", "estimacion original", "estimate", "original estimate", "story points"]);
      const idIndex = this.findColumn(headers, ["id", "item id", "pulse id"]);

      if (titleIndex === -1) {
        warnings.push(`La hoja ${sheetName} no tiene columna de titulo reconocible.`);
        continue;
      }

      const rows = matrix.slice(headerIndex + 1).flatMap((row, index) => {
        const originalTitle = this.cellToText(row[titleIndex]);
        const taskType = typeIndex >= 0 ? this.cellToText(row[typeIndex]) : null;
        if (!originalTitle) {
          return [];
        }
        const looksLikeHdu = this.normalizeHeader(originalTitle).includes("hdu");
        const isHduType = taskType ? this.normalizeHeader(taskType) === "hdu" : looksLikeHdu;
        if (!isHduType) {
          return [];
        }
        const title = this.cleanImportedStoryTitle(originalTitle);
        if (title.length < 3) {
          warnings.push(`Fila ${headerIndex + index + 2}: titulo demasiado corto.`);
          return [];
        }
        return [
          {
            title,
            originalTitle,
            source,
            externalId: idIndex >= 0 ? this.cellToText(row[idIndex]) : null,
            ownerName: ownerIndex >= 0 ? this.cellToText(row[ownerIndex]) : null,
            workflowStatus: statusIndex >= 0 ? this.cellToText(row[statusIndex]) : null,
            taskType: taskType || "HDU",
            originalEstimate: estimateIndex >= 0 ? this.cellToText(row[estimateIndex]) : null
          }
        ];
      });
      if (rows.length > 0) {
        return { source, headerRow: headerIndex + 1, rows, warnings };
      }
    }
    return { source, headerRow: 0, rows: [], warnings };
  }

  private detectImportSource(fileName: string, sheetNames: string[]): string {
    const signature = `${fileName} ${sheetNames.join(" ")}`.toLowerCase();
    return signature.includes("monday") ? "monday.com" : "spreadsheet";
  }

  private buildImportedDescription(row: ImportedStoryRow): string {
    const lines = [
      `Importado desde ${row.source}.`,
      row.ownerName ? `Dueño: ${row.ownerName}` : null,
      row.workflowStatus ? `Estado: ${row.workflowStatus}` : null,
      row.taskType ? `Tipo: ${row.taskType}` : null,
      row.originalEstimate ? `Estimación original: ${row.originalEstimate}` : null,
      row.originalTitle !== row.title ? `Título original: ${row.originalTitle}` : null
    ].filter((line): line is string => Boolean(line));
    return sanitizeText(lines.join("\n")).slice(0, 5000);
  }

  private cleanImportedStoryTitle(title: string): string {
    const trimmed = sanitizeText(title);
    const hduIndex = trimmed.search(/\bHDU\b/i);
    const cleaned = hduIndex >= 0 ? trimmed.slice(hduIndex).trim() : trimmed;
    return cleaned.length > 200 ? `${cleaned.slice(0, 197)}...` : cleaned;
  }

  private cellToText(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const text = String(value).trim();
    return text.length > 0 ? text : null;
  }

  private findColumn(row: Array<unknown>, candidates: string[]): number {
    const normalizedCandidates = candidates.map((candidate) => this.normalizeHeader(candidate));
    return row.findIndex((cell) => normalizedCandidates.includes(this.normalizeHeader(String(cell ?? ""))));
  }

  private normalizeHeader(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .toLowerCase();
  }

  private summaryExportRows(summary: SessionSummaryView): SummaryExportRow[] {
    const rows = summary.stories.flatMap((story) => {
      const base = {
        roomCode: summary.room.code,
        roomName: summary.room.name,
        storyTitle: story.title,
        owner: story.ownerName ?? "",
        workflowStatus: story.workflowStatus ?? "",
        taskType: story.taskType ?? "",
        originalEstimate: story.originalEstimate ?? "",
        finalEstimate: story.finalEstimate ?? "",
        storyStatus: story.status
      };
      if (story.rounds.length === 0) {
        return [{ ...base, round: "", participant: "", vote: "", average: "", median: "", mode: "", min: "", max: "", consensus: "" }];
      }
      return story.rounds.flatMap((round) => {
        const stats = {
          average: String(round.statistics?.average ?? ""),
          median: String(round.statistics?.median ?? ""),
          mode: String(round.statistics?.mode ?? ""),
          min: String(round.statistics?.min ?? ""),
          max: String(round.statistics?.max ?? ""),
          consensus: String(round.statistics?.consensus ?? "")
        };
        if (round.votes.length === 0) {
          return [{ ...base, round: String(round.round), participant: "", vote: "", ...stats }];
        }
        return round.votes.map((vote) => ({
          ...base,
          round: String(round.round),
          participant: vote.participantName,
          vote: vote.value,
          ...stats
        }));
      });
    });
    return rows.length ? rows : [this.emptySummaryExportRow()];
  }

  private emptySummaryExportRow(): SummaryExportRow {
    return {
      roomCode: "",
      roomName: "",
      storyTitle: "",
      owner: "",
      workflowStatus: "",
      taskType: "",
      originalEstimate: "",
      finalEstimate: "",
      storyStatus: "",
      round: "",
      participant: "",
      vote: "",
      average: "",
      median: "",
      mode: "",
      min: "",
      max: "",
      consensus: ""
    };
  }

  private csvEscape(value: string) {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  private async getActiveRound(roomId: string, storyId: string | null, number: number) {
    if (!storyId || number < 1) {
      return null;
    }
    return this.prisma.estimationRound.findFirst({ where: { roomId, storyId, number } });
  }

  private async getActiveRoundOrThrow(roomId: string, storyId: string, number: number) {
    const round = await this.getActiveRound(roomId, storyId, number);
    if (!round) {
      throw new AppError(ErrorCode.NO_ACTIVE_STORY, "No hay ronda activa.");
    }
    return round;
  }

  private async touch(roomId: string, participantId: string) {
    await Promise.all([
      this.touchRoom(roomId),
      this.prisma.participant.update({ where: { id: participantId }, data: { lastActivityAt: new Date(), connected: true } })
    ]);
  }

  private async touchRoom(roomId: string) {
    await this.prisma.room.update({ where: { id: roomId }, data: { lastActivityAt: new Date() } });
  }

  private toPrismaRole(role: ParticipantRole): PrismaParticipantRole {
    if (role === ParticipantRole.OBSERVER) {
      return PrismaParticipantRole.OBSERVER;
    }
    return PrismaParticipantRole.VOTER;
  }

  private generateSessionToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private async generateRoomCode(): Promise<string> {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const length = Number(this.config.get<string>("ROOM_CODE_LENGTH", "8"));
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = Array.from(randomBytes(length))
        .map((byte) => alphabet[byte % alphabet.length])
        .join("");
      const existing = await this.prisma.room.findUnique({ where: { code } });
      if (!existing) {
        return code;
      }
    }
    throw new Error("Unable to generate room code");
  }
}
