import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DailyMode as PrismaDailyMode,
  DailyStatus as PrismaDailyStatus,
  ParticipantRole as PrismaParticipantRole,
  RoomStatus as PrismaRoomStatus,
  RoomType as PrismaRoomType,
  StoryStatus as PrismaStoryStatus,
  TeamAvailability as PrismaTeamAvailability,
  TeamZone as PrismaTeamZone
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import { read, utils, write } from "xlsx";
import {
  FIBONACCI_DECK,
  AvatarReactionView,
  ChatMessageView,
  DailyMode,
  DailySessionView,
  ParticipantRole,
  RevealedVoteView,
  RoomStateView,
  RoomStatus,
  SessionSummaryView,
  StoryStatus,
  TeamAvailability,
  TeamAvatarId,
  TeamRoomView,
  TeamPositionEvent,
  TeamZone,
  VoteStatistics,
  calculateVoteStatistics
} from "@planning/shared";
import { PrismaService } from "../database/prisma.service";
import { AppError, ErrorCode } from "../common/app-error";
import { sanitizeOptionalText, sanitizeText } from "../common/sanitize";
import type { CreateRetrospectiveDto, CreateRoomDto, CreateStoryDto, CreateTeamDto, JoinRoomDto, ReorderStoriesDto, UpdateStoryDto } from "./dto";

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

  async createRetrospective(dto: CreateRetrospectiveDto) {
    const code = await this.generateRoomCode();
    const sessionToken = this.generateSessionToken();
    const room = await this.prisma.room.create({
      data: {
        code,
        name: sanitizeText(dto.roomName),
        type: PrismaRoomType.RETROSPECTIVE,
        participants: {
          create: {
            displayName: sanitizeText(dto.participantName),
            role: PrismaParticipantRole.MODERATOR,
            sessionToken,
            connected: true
          }
        },
        retroColumns: {
          create: [
            { title: "Salio bien", color: "emerald", position: 1 },
            { title: "Podemos mejorar", color: "rose", position: 2 },
            { title: "Ideas", color: "amber", position: 3 }
          ]
        }
      },
      include: { participants: true }
    });
    const moderator = room.participants[0];
    await this.prisma.room.update({ where: { id: room.id }, data: { moderatorParticipantId: moderator.id } });
    this.logger.log({ event: "retrospective.created", roomCode: code, participantId: moderator.id });
    return { roomCode: code, sessionToken, participantId: moderator.id, state: await this.getRoomState(code, moderator.id) };
  }

  async createTeam(dto: CreateTeamDto, userId?: string) {
    const code = await this.generateRoomCode();
    const sessionToken = this.generateSessionToken();
    const room = await this.prisma.room.create({
      data: {
        code,
        name: sanitizeText(dto.roomName),
        type: PrismaRoomType.TEAM,
        ownerUserId: userId ?? null,
        participants: {
          create: {
            displayName: sanitizeText(dto.participantName),
            role: PrismaParticipantRole.MODERATOR,
            sessionToken,
            connected: true,
            userId: userId ?? null
          }
        },
        dailySessions: {
          create: {
            date: this.dateValue(this.todayKey()),
            mode: dto.dailyMode as PrismaDailyMode,
            turnDurationSeconds: dto.turnDurationSeconds
          }
        }
      },
      include: { participants: true }
    });
    const moderator = room.participants[0];
    await this.prisma.room.update({ where: { id: room.id }, data: { moderatorParticipantId: moderator.id } });
    this.logger.log({ event: "team.created", roomCode: code, participantId: moderator.id, registered: Boolean(userId) });
    return { roomCode: code, sessionToken, participantId: moderator.id, state: await this.getRoomState(code, moderator.id) };
  }

  async getUserTeams(userId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { type: PrismaRoomType.TEAM, OR: [{ ownerUserId: userId }, { participants: { some: { userId, removedAt: null } } }] },
      orderBy: { lastActivityAt: "desc" }
    });
    return rooms.map((room) => ({ code: room.code, name: room.name, status: room.status, lastActivityAt: room.lastActivityAt.toISOString() }));
  }

  async accessTeam(roomCode: string, userId: string) {
    const room = await this.findRoom(roomCode);
    if (room.type !== PrismaRoomType.TEAM) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "La sala no pertenece a un equipo.");
    const participant = await this.prisma.participant.findFirst({ where: { roomId: room.id, userId, removedAt: null } });
    if (!participant) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Tu cuenta no pertenece a este equipo.");
    const sessionToken = this.generateSessionToken();
    await this.prisma.participant.update({ where: { id: participant.id }, data: { sessionToken, connected: true, lastActivityAt: new Date() } });
    return { roomCode: room.code, sessionToken, participantId: participant.id, state: await this.getRoomState(room.code, participant.id) };
  }

  async getPublicRoom(roomCode: string) {
    const room = await this.findRoom(roomCode);
    return { code: room.code, name: room.name, type: room.type, status: room.status, activeStoryId: room.activeStoryId };
  }

  async joinRoom(roomCode: string, dto: JoinRoomDto, userId?: string) {
    const room = await this.findRoom(roomCode);
    this.ensureRoomOpen(room.status);
    const displayName = sanitizeText(dto.participantName);
    if (userId) {
      const linked = await this.prisma.participant.findFirst({ where: { roomId: room.id, userId, removedAt: null } });
      if (linked) {
        const sessionToken = this.generateSessionToken();
        await this.prisma.participant.update({ where: { id: linked.id }, data: { sessionToken, connected: true, lastActivityAt: new Date() } });
        return { roomCode, sessionToken, participantId: linked.id, state: await this.getRoomState(roomCode, linked.id) };
      }
    }
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
        connected: true,
        userId: userId ?? null
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
    const retroColumns = room.type === PrismaRoomType.RETROSPECTIVE
      ? await this.prisma.retroColumn.findMany({ where: { roomId: room.id }, orderBy: { position: "asc" } })
      : [];
    const retroCards = room.type === PrismaRoomType.RETROSPECTIVE
      ? await this.prisma.retroCard.findMany({
          where: { roomId: room.id },
          include: {
            participant: true,
            votes: true,
            comments: { include: { participant: true }, orderBy: { createdAt: "asc" } },
            reactions: true
          },
          orderBy: [{ columnId: "asc" }, { position: "asc" }, { createdAt: "asc" }]
        })
      : [];
    const retroActions = room.type === PrismaRoomType.RETROSPECTIVE
      ? await this.prisma.retroAction.findMany({ where: { roomId: room.id }, include: { createdBy: true }, orderBy: { createdAt: "asc" } })
      : [];
    const team = room.type === PrismaRoomType.TEAM
      ? await this.getTeamView(room.id, participants, viewerParticipantId, room.moderatorParticipantId)
      : null;
    const me = viewerParticipantId ? participants.find((participant) => participant.id === viewerParticipantId) : undefined;
    return {
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        type: room.type,
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
            lastActivityAt: me.lastActivityAt.toISOString(),
            availability: me.availability as TeamAvailability,
            zone: me.zone as TeamZone,
            activity: me.activity,
            avatarId: me.avatarId as TeamAvatarId | null,
            userId: me.userId,
            positionX: me.positionX,
            positionY: me.positionY
          }
        : undefined,
      participants: participants.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        role: participant.role as ParticipantRole,
        connected: participant.connected,
        hasVoted: votes.some((vote) => vote.participantId === participant.id),
        joinedAt: participant.joinedAt.toISOString(),
        lastActivityAt: participant.lastActivityAt.toISOString(),
        availability: participant.availability as TeamAvailability,
        zone: participant.zone as TeamZone,
        activity: participant.activity,
        avatarId: participant.avatarId as TeamAvatarId | null,
        userId: participant.userId,
        positionX: participant.positionX,
        positionY: participant.positionY
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
      history,
      retrospective: room.type === PrismaRoomType.RETROSPECTIVE
        ? {
            columns: retroColumns.map((column) => ({ id: column.id, title: column.title, color: column.color, position: column.position })),
            cards: retroCards.map((card) => ({
              id: card.id,
              columnId: card.columnId,
              participantId: card.anonymous ? null : card.participantId,
              authorName: card.anonymous ? null : card.participant?.displayName ?? null,
              content: card.content,
              anonymous: card.anonymous,
              position: card.position,
              voteCount: card.votes.length,
              voterIds: card.votes.map((vote) => vote.participantId),
              votedByMe: viewerParticipantId ? card.votes.some((vote) => vote.participantId === viewerParticipantId) : false,
              canEdit: Boolean(viewerParticipantId && (card.participantId === viewerParticipantId || room.moderatorParticipantId === viewerParticipantId)),
              comments: card.comments.map((comment) => ({
                id: comment.id,
                participantId: comment.participantId,
                participantName: comment.participant.displayName,
                content: comment.content,
                createdAt: comment.createdAt.toISOString()
              })),
              reactions: Array.from(new Set(card.reactions.map((reaction) => reaction.emoji))).map((emoji) => ({
                emoji,
                count: card.reactions.filter((reaction) => reaction.emoji === emoji).length,
                participantIds: card.reactions.filter((reaction) => reaction.emoji === emoji).map((reaction) => reaction.participantId)
              })),
              createdAt: card.createdAt.toISOString()
            })),
            actions: retroActions.map((action) => ({
              id: action.id,
              cardId: action.cardId,
              content: action.content,
              assigneeName: action.assigneeName,
              completed: action.completed,
              createdByName: action.createdBy.displayName,
              createdAt: action.createdAt.toISOString()
            }))
          }
        : null,
      team,
      daily: team?.sessions[0] ?? null
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
    const normalizedValue = value.trim();
    if (!normalizedValue || normalizedValue.length > 16) {
      throw new AppError(ErrorCode.INVALID_VOTE, "La carta seleccionada no es valida.");
    }
    const round = await this.getActiveRoundOrThrow(room.id, room.activeStoryId, room.currentRound);
    await this.prisma.vote.upsert({
      where: { participantId_storyId_roundId: { participantId: participant.id, storyId: room.activeStoryId, roundId: round.id } },
      create: { roomId: room.id, storyId: room.activeStoryId, participantId: participant.id, roundId: round.id, value: normalizedValue },
      update: { value: normalizedValue }
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
        lastActivityAt: participant.lastActivityAt.toISOString(),
        availability: participant.availability as TeamAvailability,
        zone: participant.zone as TeamZone,
        activity: participant.activity,
        avatarId: participant.avatarId as TeamAvatarId | null,
        userId: participant.userId,
        positionX: participant.positionX,
        positionY: participant.positionY
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

  async createRetroCard(roomCode: string, sessionToken: string, dto: { columnId: string; content: string; anonymous: boolean }) {
    const { room, participant } = await this.requireRetroParticipant(roomCode, sessionToken);
    const column = await this.prisma.retroColumn.findFirst({ where: { id: dto.columnId, roomId: room.id } });
    if (!column) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "La columna no pertenece a esta retrospectiva.");
    const max = await this.prisma.retroCard.aggregate({ where: { columnId: column.id }, _max: { position: true } });
    await this.prisma.retroCard.create({
      data: {
        roomId: room.id,
        columnId: column.id,
        participantId: participant.id,
        content: sanitizeText(dto.content),
        anonymous: dto.anonymous,
        position: (max._max.position ?? 0) + 1
      }
    });
    await this.touch(room.id, participant.id);
  }

  async updateRetroCard(roomCode: string, sessionToken: string, cardId: string, content: string) {
    const { room, participant } = await this.requireRetroParticipant(roomCode, sessionToken);
    const card = await this.requireRetroCard(room.id, cardId);
    if (card.participantId !== participant.id && room.moderatorParticipantId !== participant.id) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Solo el autor o el moderador puede editar esta tarjeta.");
    }
    await this.prisma.retroCard.update({ where: { id: card.id }, data: { content: sanitizeText(content) } });
    await this.touch(room.id, participant.id);
  }

  async deleteRetroCard(roomCode: string, sessionToken: string, cardId: string) {
    const { room, participant } = await this.requireRetroParticipant(roomCode, sessionToken);
    const card = await this.requireRetroCard(room.id, cardId);
    if (card.participantId !== participant.id && room.moderatorParticipantId !== participant.id) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Solo el autor o el moderador puede eliminar esta tarjeta.");
    }
    await this.prisma.retroCard.delete({ where: { id: card.id } });
    await this.touch(room.id, participant.id);
  }

  async moveRetroCard(roomCode: string, sessionToken: string, cardId: string, columnId: string, position: number) {
    const { room, participant } = await this.requireRetroParticipant(roomCode, sessionToken);
    const card = await this.requireRetroCard(room.id, cardId);
    const column = await this.prisma.retroColumn.findFirst({ where: { id: columnId, roomId: room.id } });
    if (!column) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "La columna no pertenece a esta retrospectiva.");
    if (card.participantId !== participant.id && room.moderatorParticipantId !== participant.id) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Solo el autor o el moderador puede mover esta tarjeta.");
    }
    await this.prisma.retroCard.update({ where: { id: card.id }, data: { columnId, position } });
    await this.touch(room.id, participant.id);
  }

  async toggleRetroVote(roomCode: string, sessionToken: string, cardId: string) {
    const { room, participant } = await this.requireRetroParticipant(roomCode, sessionToken);
    await this.requireRetroCard(room.id, cardId);
    const existing = await this.prisma.retroVote.findUnique({ where: { cardId_participantId: { cardId, participantId: participant.id } } });
    if (existing) {
      await this.prisma.retroVote.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.retroVote.create({ data: { cardId, participantId: participant.id } });
    }
    await this.touch(room.id, participant.id);
  }

  async createRetroComment(roomCode: string, sessionToken: string, cardId: string, content: string) {
    const { room, participant } = await this.requireRetroParticipant(roomCode, sessionToken);
    await this.requireRetroCard(room.id, cardId);
    await this.prisma.retroComment.create({
      data: { cardId, participantId: participant.id, content: sanitizeText(content) }
    });
    await this.touch(room.id, participant.id);
  }

  async deleteRetroComment(roomCode: string, sessionToken: string, commentId: string) {
    const { room, participant } = await this.requireRetroParticipant(roomCode, sessionToken);
    const comment = await this.prisma.retroComment.findFirst({ where: { id: commentId, card: { roomId: room.id } } });
    if (!comment) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "El comentario no pertenece a esta retrospectiva.");
    if (comment.participantId !== participant.id && room.moderatorParticipantId !== participant.id) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Solo el autor o el moderador puede eliminar este comentario.");
    }
    await this.prisma.retroComment.delete({ where: { id: comment.id } });
    await this.touch(room.id, participant.id);
  }

  async toggleRetroReaction(roomCode: string, sessionToken: string, cardId: string, emoji: string) {
    const { room, participant } = await this.requireRetroParticipant(roomCode, sessionToken);
    await this.requireRetroCard(room.id, cardId);
    const existing = await this.prisma.retroReaction.findUnique({
      where: { cardId_participantId_emoji: { cardId, participantId: participant.id, emoji } }
    });
    if (existing) {
      await this.prisma.retroReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.retroReaction.create({ data: { cardId, participantId: participant.id, emoji } });
    }
    await this.touch(room.id, participant.id);
  }

  async createRetroAction(roomCode: string, sessionToken: string, dto: { content: string; assigneeName?: string | null; cardId?: string | null }) {
    const { room, participant } = await this.requireRetroParticipant(roomCode, sessionToken);
    if (dto.cardId) await this.requireRetroCard(room.id, dto.cardId);
    await this.prisma.retroAction.create({
      data: {
        roomId: room.id,
        cardId: dto.cardId ?? null,
        createdById: participant.id,
        content: sanitizeText(dto.content),
        assigneeName: sanitizeOptionalText(dto.assigneeName)
      }
    });
    await this.touch(room.id, participant.id);
  }

  async toggleRetroAction(roomCode: string, sessionToken: string, actionId: string) {
    const { room, participant } = await this.requireRetroParticipant(roomCode, sessionToken);
    const action = await this.prisma.retroAction.findFirst({ where: { id: actionId, roomId: room.id } });
    if (!action) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "La accion no pertenece a esta retrospectiva.");
    await this.prisma.retroAction.update({ where: { id: action.id }, data: { completed: !action.completed } });
    await this.touch(room.id, participant.id);
  }

  async deleteRetroAction(roomCode: string, sessionToken: string, actionId: string) {
    const { room, participant } = await this.requireRetroParticipant(roomCode, sessionToken);
    const action = await this.prisma.retroAction.findFirst({ where: { id: actionId, roomId: room.id } });
    if (!action) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "La accion no pertenece a esta retrospectiva.");
    if (action.createdById !== participant.id && room.moderatorParticipantId !== participant.id) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Solo el autor o el moderador puede eliminar esta accion.");
    }
    await this.prisma.retroAction.delete({ where: { id: action.id } });
    await this.touch(room.id, participant.id);
  }

  async updateTeamPresence(roomCode: string, sessionToken: string, dto: { availability: TeamAvailability; zone: TeamZone; activity?: string | null; avatarId?: TeamAvatarId }) {
    const { room, participant } = await this.requireTeamParticipant(roomCode, sessionToken);
    await this.prisma.participant.update({
      where: { id: participant.id },
      data: {
        availability: dto.availability as PrismaTeamAvailability,
        zone: dto.zone as PrismaTeamZone,
        activity: sanitizeOptionalText(dto.activity)?.slice(0, 80) ?? null,
        avatarId: dto.avatarId,
        connected: true,
        lastActivityAt: new Date()
      }
    });
    await this.touchRoom(room.id);
  }

  async updateTeamPosition(roomCode: string, sessionToken: string, dto: { x: number; y: number; zone: TeamZone }): Promise<TeamPositionEvent> {
    const { participant } = await this.requireTeamParticipant(roomCode, sessionToken);
    const updatedAt = new Date();
    await this.prisma.participant.update({
      where: { id: participant.id },
      data: {
        positionX: dto.x,
        positionY: dto.y,
        zone: dto.zone as PrismaTeamZone,
        connected: true,
        lastActivityAt: updatedAt
      }
    });
    return { participantId: participant.id, x: dto.x, y: dto.y, zone: dto.zone, updatedAt: updatedAt.toISOString() };
  }

  async createDailySession(roomCode: string, sessionToken: string, dto: { date: string; mode: DailyMode; turnDurationSeconds: number }) {
    const { room, participant } = await this.requireTeamModerator(roomCode, sessionToken);
    await this.prisma.dailySession.upsert({
      where: { roomId_date: { roomId: room.id, date: this.dateValue(dto.date) } },
      create: { roomId: room.id, date: this.dateValue(dto.date), mode: dto.mode as PrismaDailyMode, turnDurationSeconds: dto.turnDurationSeconds },
      update: { mode: dto.mode as PrismaDailyMode, turnDurationSeconds: dto.turnDurationSeconds }
    });
    await this.touch(room.id, participant.id);
  }

  async upsertDailyEntry(
    roomCode: string,
    sessionToken: string,
    dto: { dailyId: string; yesterday: string; today: string; mood?: string | null; blocker?: string | null }
  ) {
    const { room, participant } = await this.requireTeamParticipant(roomCode, sessionToken);
    const daily = await this.requireDaily(room.id, dto.dailyId);
    if (daily.status === PrismaDailyStatus.COMPLETED) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Esta daily ya esta finalizada.");
    await this.prisma.dailyEntry.upsert({
      where: { dailyId_participantId: { dailyId: daily.id, participantId: participant.id } },
      create: {
        dailyId: daily.id,
        participantId: participant.id,
        yesterday: sanitizeText(dto.yesterday),
        today: sanitizeText(dto.today),
        mood: sanitizeOptionalText(dto.mood)?.slice(0, 12) ?? null
      },
      update: {
        yesterday: sanitizeText(dto.yesterday),
        today: sanitizeText(dto.today),
        mood: sanitizeOptionalText(dto.mood)?.slice(0, 12) ?? null,
        submittedAt: new Date()
      }
    });
    const blocker = sanitizeOptionalText(dto.blocker)?.slice(0, 500);
    if (blocker) {
      const duplicate = await this.prisma.dailyBlocker.findFirst({ where: { participantId: participant.id, content: blocker, resolvedAt: null } });
      if (!duplicate) await this.prisma.dailyBlocker.create({ data: { dailyId: daily.id, participantId: participant.id, content: blocker } });
    }
    await this.touch(room.id, participant.id);
  }

  async resolveDailyBlocker(roomCode: string, sessionToken: string, blockerId: string) {
    const { room, participant } = await this.requireTeamParticipant(roomCode, sessionToken);
    const blocker = await this.prisma.dailyBlocker.findFirst({ where: { id: blockerId, daily: { roomId: room.id } } });
    if (!blocker) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "El blocker no pertenece a este equipo.");
    await this.prisma.dailyBlocker.update({ where: { id: blocker.id }, data: { resolvedAt: blocker.resolvedAt ? null : new Date(), resolvedById: blocker.resolvedAt ? null : participant.id } });
    await this.touch(room.id, participant.id);
  }

  async createDailyAction(roomCode: string, sessionToken: string, dto: { dailyId: string; content: string; assigneeName?: string | null }) {
    const { room, participant } = await this.requireTeamParticipant(roomCode, sessionToken);
    const daily = await this.requireDaily(room.id, dto.dailyId);
    await this.prisma.dailyAction.create({
      data: { dailyId: daily.id, createdById: participant.id, content: sanitizeText(dto.content), assigneeName: sanitizeOptionalText(dto.assigneeName)?.slice(0, 80) ?? null }
    });
    await this.touch(room.id, participant.id);
  }

  async toggleDailyAction(roomCode: string, sessionToken: string, actionId: string) {
    const { room, participant } = await this.requireTeamParticipant(roomCode, sessionToken);
    const action = await this.prisma.dailyAction.findFirst({ where: { id: actionId, daily: { roomId: room.id } } });
    if (!action) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "La accion no pertenece a este equipo.");
    await this.prisma.dailyAction.update({ where: { id: action.id }, data: { completed: !action.completed } });
    await this.touch(room.id, participant.id);
  }

  async startDaily(roomCode: string, sessionToken: string, dailyId: string) {
    const { room, participant } = await this.requireTeamModerator(roomCode, sessionToken);
    const daily = await this.requireDaily(room.id, dailyId);
    const participants = await this.dailyParticipants(room.id);
    if (!participants.length) throw new AppError(ErrorCode.PARTICIPANT_NOT_FOUND, "No hay participantes para iniciar la daily.");
    const now = new Date();
    await this.prisma.dailySession.update({
      where: { id: daily.id },
      data: { status: PrismaDailyStatus.ACTIVE, startedAt: daily.startedAt ?? now, completedAt: null, currentParticipantId: participants[0].id, currentTurnStartedAt: now }
    });
    await this.touch(room.id, participant.id);
  }

  async nextDailyParticipant(roomCode: string, sessionToken: string, dailyId: string) {
    const { room, participant } = await this.requireTeamModerator(roomCode, sessionToken);
    const daily = await this.requireDaily(room.id, dailyId);
    const participants = await this.dailyParticipants(room.id);
    const currentIndex = participants.findIndex((item) => item.id === daily.currentParticipantId);
    const next = participants[currentIndex + 1];
    if (next) {
      await this.prisma.dailySession.update({ where: { id: daily.id }, data: { status: PrismaDailyStatus.ACTIVE, currentParticipantId: next.id, currentTurnStartedAt: new Date() } });
    } else {
      await this.prisma.dailySession.update({ where: { id: daily.id }, data: { status: PrismaDailyStatus.COMPLETED, currentParticipantId: null, currentTurnStartedAt: null, completedAt: new Date() } });
    }
    await this.touch(room.id, participant.id);
  }

  async completeDaily(roomCode: string, sessionToken: string, dailyId: string) {
    const { room, participant } = await this.requireTeamModerator(roomCode, sessionToken);
    const daily = await this.requireDaily(room.id, dailyId);
    await this.prisma.dailySession.update({
      where: { id: daily.id },
      data: { status: PrismaDailyStatus.COMPLETED, startedAt: daily.startedAt ?? new Date(), completedAt: new Date(), currentParticipantId: null, currentTurnStartedAt: null }
    });
    await this.touch(room.id, participant.id);
  }

  async createTeamNote(roomCode: string, sessionToken: string, content: string) {
    const { room, participant } = await this.requireParticipant(roomCode, sessionToken);
    if (room.type !== PrismaRoomType.TEAM) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Esta sala no pertenece a un equipo.");
    const now = new Date();
    await this.prisma.teamNote.deleteMany({ where: { roomId: room.id, expiresAt: { lte: now } } });
    await this.prisma.teamNote.create({
      data: {
        roomId: room.id,
        participantId: participant.id,
        content: sanitizeText(content).slice(0, 500),
        expiresAt: new Date(now.getTime() + 7 * 86400000)
      }
    });
    await this.touch(room.id, participant.id);
  }

  async deleteTeamNote(roomCode: string, sessionToken: string, noteId: string) {
    const { room, participant } = await this.requireParticipant(roomCode, sessionToken);
    if (room.type !== PrismaRoomType.TEAM) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Esta sala no pertenece a un equipo.");
    const note = await this.prisma.teamNote.findFirst({ where: { id: noteId, roomId: room.id } });
    if (!note) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "La nota ya no esta disponible.");
    if (note.participantId !== participant.id && room.moderatorParticipantId !== participant.id) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Solo el autor o el moderador puede eliminar esta nota.");
    }
    await this.prisma.teamNote.delete({ where: { id: note.id } });
    await this.touch(room.id, participant.id);
  }

  private async getTeamView(
    roomId: string,
    participants: Array<{ id: string; role: PrismaParticipantRole }>,
    viewerParticipantId?: string,
    moderatorParticipantId?: string | null
  ): Promise<TeamRoomView> {
    const currentDate = new Date();
    await this.prisma.teamNote.deleteMany({ where: { roomId, expiresAt: { lte: currentDate } } });
    const [sessions, notes] = await Promise.all([
      this.prisma.dailySession.findMany({
        where: { roomId },
        include: {
          entries: { include: { participant: true }, orderBy: { submittedAt: "asc" } },
          blockers: { include: { participant: true }, orderBy: { createdAt: "asc" } },
          actions: { include: { createdBy: true }, orderBy: { createdAt: "asc" } }
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 30
      }),
      this.prisma.teamNote.findMany({
        where: { roomId, expiresAt: { gt: currentDate } },
        include: { participant: true },
        orderBy: { createdAt: "desc" },
        take: 100
      })
    ]);
    const eligibleCount = Math.max(1, participants.filter((item) => item.role !== PrismaParticipantRole.OBSERVER).length);
    const now = Date.now();
    const views: DailySessionView[] = sessions.map((session) => {
      const durationMinutes = session.startedAt
        ? Math.max(0, Math.round(((session.completedAt?.getTime() ?? now) - session.startedAt.getTime()) / 60000))
        : null;
      return {
        id: session.id,
        date: session.date.toISOString().slice(0, 10),
        mode: session.mode as DailyMode,
        status: session.status,
        currentParticipantId: session.currentParticipantId,
        currentTurnStartedAt: session.currentTurnStartedAt?.toISOString() ?? null,
        turnDurationSeconds: session.turnDurationSeconds,
        startedAt: session.startedAt?.toISOString() ?? null,
        completedAt: session.completedAt?.toISOString() ?? null,
        durationMinutes,
        participationRate: Number(((session.entries.length / eligibleCount) * 100).toFixed(1)),
        entries: session.entries.map((entry) => ({
          id: entry.id,
          participantId: entry.participantId,
          participantName: entry.participant.displayName,
          yesterday: entry.yesterday,
          today: entry.today,
          mood: entry.mood,
          submittedAt: entry.submittedAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString()
        })),
        blockers: session.blockers.map((blocker) => ({
          id: blocker.id,
          dailyId: blocker.dailyId,
          participantId: blocker.participantId,
          participantName: blocker.participant.displayName,
          content: blocker.content,
          resolvedAt: blocker.resolvedAt?.toISOString() ?? null,
          resolvedById: blocker.resolvedById,
          createdAt: blocker.createdAt.toISOString(),
          ageDays: Math.max(0, Math.floor((now - blocker.createdAt.getTime()) / 86400000))
        })),
        actions: session.actions.map((action) => ({
          id: action.id,
          dailyId: action.dailyId,
          content: action.content,
          assigneeName: action.assigneeName,
          completed: action.completed,
          createdByName: action.createdBy.displayName,
          createdAt: action.createdAt.toISOString()
        }))
      };
    });
    const blockers = views.flatMap((session) => session.blockers);
    const completedDurations = views.filter((session) => session.completedAt && session.durationMinutes !== null).map((session) => session.durationMinutes as number);
    const resolutionDays = blockers
      .filter((blocker) => blocker.resolvedAt)
      .map((blocker) => (new Date(blocker.resolvedAt as string).getTime() - new Date(blocker.createdAt).getTime()) / 86400000);
    const blockerCounts = blockers.reduce<Map<string, { content: string; count: number }>>((counts, blocker) => {
      const key = blocker.content.trim().toLowerCase();
      const current = counts.get(key);
      counts.set(key, { content: current?.content ?? blocker.content, count: (current?.count ?? 0) + 1 });
      return counts;
    }, new Map());
    return {
      sessions: views,
      notes: notes.map((note) => ({
        id: note.id,
        participantId: note.participantId,
        participantName: note.participant.displayName,
        avatarId: note.participant.avatarId as TeamAvatarId | null,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
        expiresAt: note.expiresAt.toISOString(),
        canDelete: note.participantId === viewerParticipantId || moderatorParticipantId === viewerParticipantId
      })),
      metrics: {
        participationRate: views[0]?.participationRate ?? 0,
        openBlockers: blockers.filter((blocker) => !blocker.resolvedAt).length,
        averageDailyMinutes: completedDurations.length ? Number((completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length).toFixed(1)) : null,
        averageResolutionDays: resolutionDays.length ? Number((resolutionDays.reduce((sum, value) => sum + value, 0) / resolutionDays.length).toFixed(1)) : null,
        recurringBlockers: Array.from(blockerCounts.values()).filter((item) => item.count > 1).sort((a, b) => b.count - a.count).slice(0, 5)
      }
    };
  }

  private async findRoom(roomCode: string) {
    const room = await this.prisma.room.findUnique({ where: { code: roomCode.toUpperCase() } });
    if (!room) {
      throw new AppError(ErrorCode.ROOM_NOT_FOUND, "La sala solicitada no existe.");
    }
    return room;
  }

  private async requireTeamParticipant(roomCode: string, sessionToken: string) {
    const context = await this.requireParticipant(roomCode, sessionToken);
    if (context.room.type !== PrismaRoomType.TEAM) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Esta sala no pertenece a un equipo.");
    if (context.participant.role === PrismaParticipantRole.OBSERVER) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Los observadores no pueden modificar la daily.");
    return context;
  }

  private async requireTeamModerator(roomCode: string, sessionToken: string) {
    const context = await this.requireModerator(roomCode, sessionToken);
    if (context.room.type !== PrismaRoomType.TEAM) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Esta sala no pertenece a un equipo.");
    return context;
  }

  private async requireDaily(roomId: string, dailyId: string) {
    const daily = await this.prisma.dailySession.findFirst({ where: { id: dailyId, roomId } });
    if (!daily) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "La daily no pertenece a este equipo.");
    return daily;
  }

  private dailyParticipants(roomId: string) {
    return this.prisma.participant.findMany({
      where: { roomId, removedAt: null, role: { not: PrismaParticipantRole.OBSERVER } },
      orderBy: { joinedAt: "asc" }
    });
  }

  private async requireRetroParticipant(roomCode: string, sessionToken: string) {
    const context = await this.requireParticipant(roomCode, sessionToken);
    if (context.room.type !== PrismaRoomType.RETROSPECTIVE) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Esta sala no es una retrospectiva.");
    }
    if (context.participant.role === PrismaParticipantRole.OBSERVER) {
      throw new AppError(ErrorCode.FORBIDDEN_ACTION, "Los observadores no pueden modificar la retrospectiva.");
    }
    return context;
  }

  private async requireRetroCard(roomId: string, cardId: string) {
    const card = await this.prisma.retroCard.findFirst({ where: { id: cardId, roomId } });
    if (!card) throw new AppError(ErrorCode.FORBIDDEN_ACTION, "La tarjeta no pertenece a esta retrospectiva.");
    return card;
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

  private todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  private dateValue(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
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
