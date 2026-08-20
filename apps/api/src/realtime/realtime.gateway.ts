import { Logger, UseFilters } from "@nestjs/common";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import {
  ClientEvents,
  ServerEvents,
  avatarReactionSchema,
  chatMessageSchema,
  createStorySchema,
  dailyActionCreateSchema,
  dailyActionToggleSchema,
  dailyBlockerResolveSchema,
  dailyEntrySchema,
  dailyIdSchema,
  dailySessionCreateSchema,
  finalizeStorySchema,
  joinRoomSchema,
  reconnectSchema,
  retroActionCreateSchema,
  retroActionIdSchema,
  retroCardCreateSchema,
  retroCardIdSchema,
  retroCardMoveSchema,
  retroCardUpdateSchema,
  retroCommentCreateSchema,
  retroCommentDeleteSchema,
  retroReactionToggleSchema,
  reorderStoriesSchema,
  roomCrashSchema,
  teamNoteCreateSchema,
  teamNoteDeleteSchema,
  teamPresenceSchema,
  teamPositionSchema,
  updateStorySchema,
  voteSubmitSchema
} from "@planning/shared";
import { Server, Socket } from "socket.io";
import { z } from "zod";
import { toErrorBody } from "../common/app-error";
import { RedisService } from "../redis/redis.service";
import { RoomsService } from "../rooms/rooms.service";

interface SocketData {
  roomCode?: string;
  participantId?: string;
  sessionToken?: string;
}

const storyIdSchema = z.object({
  roomCode: z.string(),
  storyId: z.string().uuid(),
  sessionToken: z.string().min(24)
});

const tokenSchema = z.object({
  roomCode: z.string(),
  sessionToken: z.string().min(24)
});

const participantRoleSchema = tokenSchema.merge(
  z.object({
    participantId: z.string().uuid(),
    role: z.enum(["VOTER", "OBSERVER"])
  })
);

const participantRemoveSchema = tokenSchema.merge(
  z.object({
    participantId: z.string().uuid()
  })
);

@UseFilters()
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true
  },
  maxHttpBufferSize: 1e6
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly rooms: RoomsService,
    private readonly redis: RedisService
  ) {}

  handleConnection(client: Socket) {
    this.logger.log({ event: "socket.connected", socketId: client.id });
  }

  async handleDisconnect(client: Socket) {
    const data = client.data as SocketData;
    const participantId = data.participantId ?? (await this.redis.getSocketParticipant(client.id));
    if (participantId) {
      await this.rooms.disconnectParticipant(participantId);
      await this.redis.clearSocket(client.id);
      if (data.roomCode) {
        await this.broadcastState(data.roomCode, ServerEvents.PARTICIPANT_LEFT);
      }
    }
  }

  @SubscribeMessage(ClientEvents.ROOM_JOIN)
  async join(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = joinRoomSchema.parse(payload);
      const result = await this.rooms.joinRoom(parsed.roomCode, parsed);
      await this.attach(client, parsed.roomCode, result.participantId, result.sessionToken);
      await this.broadcastState(parsed.roomCode, ServerEvents.PARTICIPANT_JOINED);
      client.emit(ServerEvents.ROOM_STATE, result.state);
      return { ok: true, data: { sessionToken: result.sessionToken, participantId: result.participantId } };
    });
  }

  @SubscribeMessage(ClientEvents.ROOM_SYNC)
  async sync(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = reconnectSchema.parse(payload);
      const result = await this.rooms.reconnect(parsed.roomCode, parsed.sessionToken);
      await this.attach(client, parsed.roomCode, result.participantId, result.sessionToken);
      client.emit(ServerEvents.ROOM_STATE, result.state);
      await this.broadcastState(parsed.roomCode, ServerEvents.PARTICIPANT_UPDATED);
      return { ok: true, data: { participantId: result.participantId } };
    });
  }

  @SubscribeMessage(ClientEvents.PARTICIPANT_UPDATE)
  async updateParticipant(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = participantRoleSchema.parse(payload);
      await this.rooms.updateParticipantRole(parsed.roomCode, parsed.participantId, parsed.sessionToken, parsed.role);
      await this.broadcastState(parsed.roomCode, ServerEvents.PARTICIPANT_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.PARTICIPANT_REMOVE)
  async removeParticipant(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = participantRemoveSchema.parse(payload);
      await this.rooms.removeParticipant(parsed.roomCode, parsed.participantId, parsed.sessionToken);
      await this.broadcastState(parsed.roomCode, ServerEvents.PARTICIPANT_LEFT);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.STORY_CREATE)
  async createStory(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.withToken(client, payload, createStorySchema, async (base, dto) => {
      await this.rooms.createStory(base.roomCode, base.sessionToken, dto);
      await this.broadcastState(base.roomCode, ServerEvents.STORY_CREATED);
    });
  }

  @SubscribeMessage(ClientEvents.STORY_UPDATE)
  async updateStory(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    const schema = storyIdSchema.merge(z.object({ data: updateStorySchema }));
    return this.wrap(client, async () => {
      const parsed = schema.parse(payload);
      await this.rooms.updateStory(parsed.roomCode, parsed.storyId, parsed.sessionToken, parsed.data);
      await this.broadcastState(parsed.roomCode, ServerEvents.STORY_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.STORY_DELETE)
  async deleteStory(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = storyIdSchema.parse(payload);
      await this.rooms.deleteStory(parsed.roomCode, parsed.storyId, parsed.sessionToken);
      await this.broadcastState(parsed.roomCode, ServerEvents.STORY_DELETED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.STORY_REORDER)
  async reorderStories(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    const schema = tokenSchema.merge(reorderStoriesSchema);
    return this.wrap(client, async () => {
      const parsed = schema.parse(payload);
      await this.rooms.reorderStories(parsed.roomCode, parsed.sessionToken, { storyIds: parsed.storyIds });
      await this.broadcastState(parsed.roomCode, ServerEvents.STORY_REORDERED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.STORY_ACTIVATE)
  async activateStory(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = storyIdSchema.parse(payload);
      await this.rooms.activateStory(parsed.roomCode, parsed.storyId, parsed.sessionToken);
      await this.broadcastState(parsed.roomCode, ServerEvents.STORY_ACTIVATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.STORY_SKIP)
  async skipStory(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = storyIdSchema.parse(payload);
      await this.rooms.skipStory(parsed.roomCode, parsed.storyId, parsed.sessionToken);
      await this.broadcastState(parsed.roomCode, ServerEvents.STORY_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.VOTE_SUBMIT)
  async submitVote(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = voteSubmitSchema.merge(z.object({ sessionToken: z.string().min(24) })).parse(payload);
      await this.rooms.submitVote(parsed.roomCode, parsed.sessionToken, parsed.value);
      await this.broadcastState(parsed.roomCode, ServerEvents.VOTE_STATUS);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.VOTE_CLEAR)
  async clearVote(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.parse(payload);
      await this.rooms.clearVote(parsed.roomCode, parsed.sessionToken);
      await this.broadcastState(parsed.roomCode, ServerEvents.VOTE_STATUS);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.ROUND_REVEAL)
  async revealRound(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.parse(payload);
      await this.rooms.revealRound(parsed.roomCode, parsed.sessionToken);
      await this.broadcastState(parsed.roomCode, ServerEvents.ROUND_REVEALED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.ROUND_RESTART)
  async restartRound(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.parse(payload);
      await this.rooms.restartRound(parsed.roomCode, parsed.sessionToken);
      await this.broadcastState(parsed.roomCode, ServerEvents.ROUND_RESTARTED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.STORY_FINALIZE)
  async finalizeStory(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = finalizeStorySchema.merge(z.object({ roomCode: z.string(), sessionToken: z.string().min(24) })).parse(payload);
      await this.rooms.finalizeStory(parsed.roomCode, parsed.storyId, parsed.sessionToken, parsed.finalEstimate);
      await this.broadcastState(parsed.roomCode, ServerEvents.STORY_FINALIZED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.ROOM_CLOSE)
  async closeRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.parse(payload);
      await this.rooms.closeRoom(parsed.roomCode, parsed.sessionToken);
      await this.broadcastState(parsed.roomCode, ServerEvents.ROOM_CLOSED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.ROOM_REOPEN)
  async reopenRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.parse(payload);
      await this.rooms.reopenRoom(parsed.roomCode, parsed.sessionToken);
      await this.broadcastState(parsed.roomCode, ServerEvents.ROOM_REOPENED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.CHAT_SEND)
  async sendChatMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.withToken(client, payload, chatMessageSchema, async (base, dto) => {
      await this.rooms.sendChatMessage(base.roomCode, base.sessionToken, dto);
      await this.broadcastState(base.roomCode, ServerEvents.CHAT_UPDATED);
    });
  }

  @SubscribeMessage(ClientEvents.REACTION_SEND)
  async sendReaction(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.withToken(client, payload, avatarReactionSchema, async (base, dto) => {
      await this.rooms.sendReaction(base.roomCode, base.sessionToken, dto.emoji);
      await this.broadcastState(base.roomCode, ServerEvents.REACTION_CREATED);
    });
  }

  @SubscribeMessage(ClientEvents.ROOM_CRASH)
  async triggerCrash(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(roomCrashSchema).parse(payload);
      await this.rooms.validateParticipantSession(parsed.roomCode, parsed.sessionToken, { allowClosed: true });
      this.server.to(parsed.roomCode).emit(ServerEvents.ROOM_CRASH, {
        action: parsed.action,
        startsAt: Date.now() + 250,
        countdown: parsed.action === "boom" ? 3 : 0
      });
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.RETRO_CARD_CREATE)
  async createRetroCard(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.withToken(client, payload, retroCardCreateSchema, async (base, dto) => {
      await this.rooms.createRetroCard(base.roomCode, base.sessionToken, dto);
      await this.broadcastState(base.roomCode, ServerEvents.RETRO_UPDATED);
    });
  }

  @SubscribeMessage(ClientEvents.RETRO_CARD_UPDATE)
  async updateRetroCard(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(retroCardUpdateSchema).parse(payload);
      await this.rooms.updateRetroCard(parsed.roomCode, parsed.sessionToken, parsed.cardId, parsed.content);
      await this.broadcastState(parsed.roomCode, ServerEvents.RETRO_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.RETRO_CARD_DELETE)
  async deleteRetroCard(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(retroCardIdSchema).parse(payload);
      await this.rooms.deleteRetroCard(parsed.roomCode, parsed.sessionToken, parsed.cardId);
      await this.broadcastState(parsed.roomCode, ServerEvents.RETRO_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.RETRO_CARD_MOVE)
  async moveRetroCard(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(retroCardMoveSchema).parse(payload);
      await this.rooms.moveRetroCard(parsed.roomCode, parsed.sessionToken, parsed.cardId, parsed.columnId, parsed.position);
      await this.broadcastState(parsed.roomCode, ServerEvents.RETRO_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.RETRO_VOTE_TOGGLE)
  async toggleRetroVote(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(retroCardIdSchema).parse(payload);
      await this.rooms.toggleRetroVote(parsed.roomCode, parsed.sessionToken, parsed.cardId);
      await this.broadcastState(parsed.roomCode, ServerEvents.RETRO_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.RETRO_ACTION_CREATE)
  async createRetroAction(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.withToken(client, payload, retroActionCreateSchema, async (base, dto) => {
      await this.rooms.createRetroAction(base.roomCode, base.sessionToken, dto);
      await this.broadcastState(base.roomCode, ServerEvents.RETRO_UPDATED);
    });
  }

  @SubscribeMessage(ClientEvents.RETRO_ACTION_TOGGLE)
  async toggleRetroAction(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(retroActionIdSchema).parse(payload);
      await this.rooms.toggleRetroAction(parsed.roomCode, parsed.sessionToken, parsed.actionId);
      await this.broadcastState(parsed.roomCode, ServerEvents.RETRO_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.RETRO_ACTION_DELETE)
  async deleteRetroAction(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(retroActionIdSchema).parse(payload);
      await this.rooms.deleteRetroAction(parsed.roomCode, parsed.sessionToken, parsed.actionId);
      await this.broadcastState(parsed.roomCode, ServerEvents.RETRO_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.RETRO_COMMENT_CREATE)
  async createRetroComment(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(retroCommentCreateSchema).parse(payload);
      await this.rooms.createRetroComment(parsed.roomCode, parsed.sessionToken, parsed.cardId, parsed.content);
      await this.broadcastState(parsed.roomCode, ServerEvents.RETRO_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.RETRO_COMMENT_DELETE)
  async deleteRetroComment(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(retroCommentDeleteSchema).parse(payload);
      await this.rooms.deleteRetroComment(parsed.roomCode, parsed.sessionToken, parsed.commentId);
      await this.broadcastState(parsed.roomCode, ServerEvents.RETRO_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.RETRO_REACTION_TOGGLE)
  async toggleRetroReaction(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(retroReactionToggleSchema).parse(payload);
      await this.rooms.toggleRetroReaction(parsed.roomCode, parsed.sessionToken, parsed.cardId, parsed.emoji);
      await this.broadcastState(parsed.roomCode, ServerEvents.RETRO_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.TEAM_PRESENCE_UPDATE)
  async updateTeamPresence(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.withToken(client, payload, teamPresenceSchema, async (base, dto) => {
      await this.rooms.updateTeamPresence(base.roomCode, base.sessionToken, dto);
      await this.broadcastState(base.roomCode, ServerEvents.TEAM_UPDATED);
    });
  }

  @SubscribeMessage(ClientEvents.TEAM_POSITION_UPDATE)
  async updateTeamPosition(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.withToken(client, payload, teamPositionSchema, async (base, dto) => {
      const event = await this.rooms.updateTeamPosition(base.roomCode, base.sessionToken, dto);
      this.server.to(base.roomCode).emit(ServerEvents.TEAM_POSITION_UPDATED, event);
    });
  }

  @SubscribeMessage(ClientEvents.TEAM_NOTE_CREATE)
  async createTeamNote(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.withToken(client, payload, teamNoteCreateSchema, async (base, dto) => {
      await this.rooms.createTeamNote(base.roomCode, base.sessionToken, dto.content);
      await this.broadcastState(base.roomCode, ServerEvents.TEAM_UPDATED);
    });
  }

  @SubscribeMessage(ClientEvents.TEAM_NOTE_DELETE)
  async deleteTeamNote(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(teamNoteDeleteSchema).parse(payload);
      await this.rooms.deleteTeamNote(parsed.roomCode, parsed.sessionToken, parsed.noteId);
      await this.broadcastState(parsed.roomCode, ServerEvents.TEAM_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.DAILY_SESSION_CREATE)
  async createDailySession(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.withToken(client, payload, dailySessionCreateSchema, async (base, dto) => {
      await this.rooms.createDailySession(base.roomCode, base.sessionToken, dto);
      await this.broadcastState(base.roomCode, ServerEvents.DAILY_UPDATED);
    });
  }

  @SubscribeMessage(ClientEvents.DAILY_ENTRY_UPSERT)
  async upsertDailyEntry(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.withToken(client, payload, dailyEntrySchema, async (base, dto) => {
      await this.rooms.upsertDailyEntry(base.roomCode, base.sessionToken, dto);
      await this.broadcastState(base.roomCode, ServerEvents.DAILY_UPDATED);
    });
  }

  @SubscribeMessage(ClientEvents.DAILY_BLOCKER_RESOLVE)
  async resolveDailyBlocker(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(dailyBlockerResolveSchema).parse(payload);
      await this.rooms.resolveDailyBlocker(parsed.roomCode, parsed.sessionToken, parsed.blockerId);
      await this.broadcastState(parsed.roomCode, ServerEvents.DAILY_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.DAILY_ACTION_CREATE)
  async createDailyAction(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.withToken(client, payload, dailyActionCreateSchema, async (base, dto) => {
      await this.rooms.createDailyAction(base.roomCode, base.sessionToken, dto);
      await this.broadcastState(base.roomCode, ServerEvents.DAILY_UPDATED);
    });
  }

  @SubscribeMessage(ClientEvents.DAILY_ACTION_TOGGLE)
  async toggleDailyAction(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(dailyActionToggleSchema).parse(payload);
      await this.rooms.toggleDailyAction(parsed.roomCode, parsed.sessionToken, parsed.actionId);
      await this.broadcastState(parsed.roomCode, ServerEvents.DAILY_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.DAILY_START)
  async startDaily(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(dailyIdSchema).parse(payload);
      await this.rooms.startDaily(parsed.roomCode, parsed.sessionToken, parsed.dailyId);
      await this.broadcastState(parsed.roomCode, ServerEvents.DAILY_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.DAILY_NEXT)
  async nextDailyParticipant(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(dailyIdSchema).parse(payload);
      await this.rooms.nextDailyParticipant(parsed.roomCode, parsed.sessionToken, parsed.dailyId);
      await this.broadcastState(parsed.roomCode, ServerEvents.DAILY_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.DAILY_COMPLETE)
  async completeDaily(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(dailyIdSchema).parse(payload);
      await this.rooms.completeDaily(parsed.roomCode, parsed.sessionToken, parsed.dailyId);
      await this.broadcastState(parsed.roomCode, ServerEvents.DAILY_UPDATED);
      return { ok: true };
    });
  }

  @SubscribeMessage(ClientEvents.ROOM_LEAVE)
  async leaveRoom(@ConnectedSocket() client: Socket) {
    return this.wrap(client, async () => {
      const data = client.data as SocketData;
      if (data.participantId) {
        await this.rooms.disconnectParticipant(data.participantId);
      }
      if (data.roomCode) {
        client.leave(data.roomCode);
        await this.broadcastState(data.roomCode, ServerEvents.PARTICIPANT_LEFT);
      }
      return { ok: true };
    });
  }

  private async withToken<T extends z.ZodTypeAny>(
    client: Socket,
    payload: unknown,
    schema: T,
    handler: (base: { roomCode: string; sessionToken: string }, data: z.infer<T>) => Promise<void>
  ) {
    return this.wrap(client, async () => {
      const parsed = tokenSchema.merge(z.object({ data: schema })).parse(payload);
      await handler({ roomCode: parsed.roomCode, sessionToken: parsed.sessionToken }, parsed.data);
      return { ok: true };
    });
  }

  private async attach(client: Socket, roomCode: string, participantId: string, sessionToken: string) {
    client.join(roomCode);
    client.data = { ...(client.data as SocketData), roomCode, participantId, sessionToken };
    await this.redis.setSocketParticipant(client.id, participantId);
  }

  private async broadcastState(roomCode: string, eventName: string) {
    const state = await this.rooms.getRoomState(roomCode);
    this.server.to(roomCode).emit(eventName, state);
    this.server.to(roomCode).emit(ServerEvents.ROOM_UPDATED, state);
  }

  private async wrap<T>(client: Socket, handler: () => Promise<T>) {
    const started = Date.now();
    try {
      const result = await handler();
      this.logger.log({ event: "socket.event", socketId: client.id, result: "ok", duration: Date.now() - started });
      return result;
    } catch (error) {
      const body = toErrorBody(error);
      client.emit(ServerEvents.ERROR, body);
      this.logger.warn({ event: "socket.event", socketId: client.id, result: "error", code: body.code, duration: Date.now() - started });
      return { ok: false, error: body };
    }
  }
}
