import { z } from "zod";

export const RoomStatus = {
  WAITING: "WAITING",
  VOTING: "VOTING",
  REVEALED: "REVEALED",
  CLOSED: "CLOSED"
} as const;

export const RoomType = {
  PLANNING: "PLANNING",
  RETROSPECTIVE: "RETROSPECTIVE",
  TEAM: "TEAM"
} as const;

export const TeamAvailability = {
  AVAILABLE: "AVAILABLE",
  FOCUS: "FOCUS",
  BUSY: "BUSY",
  AWAY: "AWAY",
  BREAK: "BREAK"
} as const;

export const TeamZone = {
  TEAM_ROOM: "TEAM_ROOM",
  DAILY_ROOM: "DAILY_ROOM",
  PLANNING_ROOM: "PLANNING_ROOM",
  RETROSPECTIVE_ROOM: "RETROSPECTIVE_ROOM",
  COFFEE_AREA: "COFFEE_AREA"
} as const;

export const DailyMode = {
  SYNCHRONOUS: "SYNCHRONOUS",
  ASYNCHRONOUS: "ASYNCHRONOUS",
  HYBRID: "HYBRID"
} as const;

export const DailyStatus = {
  OPEN: "OPEN",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED"
} as const;

export const ParticipantRole = {
  MODERATOR: "MODERATOR",
  VOTER: "VOTER",
  OBSERVER: "OBSERVER"
} as const;

export const StoryStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  ESTIMATED: "ESTIMATED",
  SKIPPED: "SKIPPED"
} as const;

export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus];
export type RoomType = (typeof RoomType)[keyof typeof RoomType];
export type ParticipantRole = (typeof ParticipantRole)[keyof typeof ParticipantRole];
export type StoryStatus = (typeof StoryStatus)[keyof typeof StoryStatus];
export type TeamAvailability = (typeof TeamAvailability)[keyof typeof TeamAvailability];
export type TeamZone = (typeof TeamZone)[keyof typeof TeamZone];
export type DailyMode = (typeof DailyMode)[keyof typeof DailyMode];
export type DailyStatus = (typeof DailyStatus)[keyof typeof DailyStatus];

export const FIBONACCI_DECK = ["0", "0.5", "1", "2", "3", "5", "8", "13", "20", "21", "40", "100", "?", "BREAK"] as const;
export type VoteValue = (typeof FIBONACCI_DECK)[number] | string;

export const ClientEvents = {
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_SYNC: "room:sync",
  PARTICIPANT_UPDATE: "participant:update",
  PARTICIPANT_REMOVE: "participant:remove",
  STORY_CREATE: "story:create",
  STORY_UPDATE: "story:update",
  STORY_DELETE: "story:delete",
  STORY_REORDER: "story:reorder",
  STORY_ACTIVATE: "story:activate",
  STORY_SKIP: "story:skip",
  STORY_FINALIZE: "story:finalize",
  VOTE_SUBMIT: "vote:submit",
  VOTE_CLEAR: "vote:clear",
  ROUND_REVEAL: "round:reveal",
  ROUND_RESTART: "round:restart",
  ROOM_CLOSE: "room:close",
  ROOM_REOPEN: "room:reopen",
  CHAT_SEND: "chat:send",
  REACTION_SEND: "reaction:send",
  ROOM_CRASH: "room:crash",
  RETRO_CARD_CREATE: "retro:card:create",
  RETRO_CARD_UPDATE: "retro:card:update",
  RETRO_CARD_DELETE: "retro:card:delete",
  RETRO_CARD_MOVE: "retro:card:move",
  RETRO_VOTE_TOGGLE: "retro:vote:toggle",
  RETRO_ACTION_CREATE: "retro:action:create",
  RETRO_ACTION_TOGGLE: "retro:action:toggle",
  RETRO_ACTION_DELETE: "retro:action:delete",
  RETRO_COMMENT_CREATE: "retro:comment:create",
  RETRO_COMMENT_DELETE: "retro:comment:delete",
  RETRO_REACTION_TOGGLE: "retro:reaction:toggle",
  TEAM_PRESENCE_UPDATE: "team:presence:update",
  TEAM_POSITION_UPDATE: "team:position:update",
  TEAM_NOTE_CREATE: "team:note:create",
  TEAM_NOTE_DELETE: "team:note:delete",
  DAILY_SESSION_CREATE: "daily:session:create",
  DAILY_ENTRY_UPSERT: "daily:entry:upsert",
  DAILY_BLOCKER_RESOLVE: "daily:blocker:resolve",
  DAILY_ACTION_CREATE: "daily:action:create",
  DAILY_ACTION_TOGGLE: "daily:action:toggle",
  DAILY_START: "daily:start",
  DAILY_NEXT: "daily:next",
  DAILY_COMPLETE: "daily:complete"
} as const;

export const ServerEvents = {
  ROOM_STATE: "room:state",
  ROOM_UPDATED: "room:updated",
  ROOM_CLOSED: "room:closed",
  PARTICIPANT_JOINED: "participant:joined",
  PARTICIPANT_LEFT: "participant:left",
  PARTICIPANT_UPDATED: "participant:updated",
  STORY_CREATED: "story:created",
  STORY_UPDATED: "story:updated",
  STORY_DELETED: "story:deleted",
  STORY_REORDERED: "story:reordered",
  STORY_ACTIVATED: "story:activated",
  STORY_FINALIZED: "story:finalized",
  VOTE_STATUS: "vote:status",
  VOTE_REVEALED: "vote:revealed",
  ROUND_STARTED: "round:started",
  ROUND_REVEALED: "round:revealed",
  ROUND_RESTARTED: "round:restarted",
  ROOM_REOPENED: "room:reopened",
  CHAT_UPDATED: "chat:updated",
  REACTION_CREATED: "reaction:created",
  ROOM_CRASH: "room:crash",
  RETRO_UPDATED: "retro:updated",
  TEAM_UPDATED: "team:updated",
  TEAM_POSITION_UPDATED: "team:position:updated",
  DAILY_UPDATED: "daily:updated",
  ERROR: "error"
} as const;

export type ClientEventName = (typeof ClientEvents)[keyof typeof ClientEvents];
export type ServerEventName = (typeof ServerEvents)[keyof typeof ServerEvents];

export const ApiErrorCode = {
  ROOM_NOT_FOUND: "ROOM_NOT_FOUND",
  ROOM_CLOSED: "ROOM_CLOSED",
  INVALID_SESSION: "INVALID_SESSION",
  PARTICIPANT_NOT_FOUND: "PARTICIPANT_NOT_FOUND",
  FORBIDDEN_ACTION: "FORBIDDEN_ACTION",
  STORY_NOT_FOUND: "STORY_NOT_FOUND",
  NO_ACTIVE_STORY: "NO_ACTIVE_STORY",
  VOTING_NOT_ACTIVE: "VOTING_NOT_ACTIVE",
  ROUND_ALREADY_REVEALED: "ROUND_ALREADY_REVEALED",
  INVALID_VOTE: "INVALID_VOTE",
  INVALID_IMPORT: "INVALID_IMPORT",
  DUPLICATE_PARTICIPANT_NAME: "DUPLICATE_PARTICIPANT_NAME",
  USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  HTTP_ERROR: "HTTP_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SOCKET_TIMEOUT: "SOCKET_TIMEOUT"
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export const roomCodeSchema = z.string().trim().min(4).max(16).regex(/^[A-Z0-9]+$/);
export const roomNameSchema = z.string().trim().min(3).max(80);
export const participantNameSchema = z.string().trim().min(2).max(40);
export const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
export const passwordSchema = z.string().min(8).max(128);
export const authRegisterSchema = z.object({ email: emailSchema, password: passwordSchema, displayName: participantNameSchema });
export const authLoginSchema = z.object({ email: emailSchema, password: passwordSchema });
export const storyTitleSchema = z.string().trim().min(3).max(200);
export const longTextSchema = z.string().trim().max(5000).optional().nullable();
export const roleSchema = z.nativeEnum(ParticipantRole);
export const voteValueSchema = z.string().trim().min(1).max(16);
export const chatMessageSchema = z
  .object({
    content: z.string().trim().max(500).optional().nullable(),
    gifUrl: z.string().trim().url().max(1000).optional().nullable(),
    gifTitle: z.string().trim().max(120).optional().nullable()
  })
  .refine((value) => Boolean(value.content || value.gifUrl), "El mensaje debe tener texto o GIF.");
export const avatarReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(12)
});
export const roomCrashSchema = z.object({
  action: z.enum(["boom", "back"])
});

export const retroCardCreateSchema = z.object({
  columnId: z.string().uuid(),
  content: z.string().trim().min(1).max(1000),
  anonymous: z.boolean().default(false)
});

export const retroCardUpdateSchema = z.object({
  cardId: z.string().uuid(),
  content: z.string().trim().min(1).max(1000)
});

export const retroCardMoveSchema = z.object({
  cardId: z.string().uuid(),
  columnId: z.string().uuid(),
  position: z.number().int().min(1)
});

export const retroCardIdSchema = z.object({ cardId: z.string().uuid() });

export const retroActionCreateSchema = z.object({
  content: z.string().trim().min(1).max(500),
  assigneeName: z.string().trim().max(80).optional().nullable(),
  cardId: z.string().uuid().optional().nullable()
});

export const retroActionIdSchema = z.object({ actionId: z.string().uuid() });

export const retroCommentCreateSchema = z.object({
  cardId: z.string().uuid(),
  content: z.string().trim().min(1).max(500)
});

export const retroCommentDeleteSchema = z.object({ commentId: z.string().uuid() });

export const retroReactionToggleSchema = z.object({
  cardId: z.string().uuid(),
  emoji: z.string().trim().min(1).max(12)
});

export const TEAM_AVATAR_IDS = [
  "sage",
  "marina",
  "ember",
  "teal",
  "pearl",
  "coral",
  "copper",
  "lilac",
  "auburn",
  "moss",
  "aqua",
  "amber",
  "cloud",
  "snow",
  "curly",
  "coral-overshirt",
  "mustard",
  "cream"
] as const;

export type TeamAvatarId = (typeof TEAM_AVATAR_IDS)[number];
export const teamAvatarIdSchema = z.enum(TEAM_AVATAR_IDS);

export const teamPresenceSchema = z.object({
  availability: z.nativeEnum(TeamAvailability),
  zone: z.nativeEnum(TeamZone),
  activity: z.string().trim().max(80).optional().nullable(),
  avatarId: teamAvatarIdSchema.optional()
});

export const teamPositionSchema = z.object({
  x: z.number().min(0.03).max(0.97),
  y: z.number().min(0.05).max(0.95),
  zone: z.nativeEnum(TeamZone)
});

export const teamNoteCreateSchema = z.object({
  content: z.string().trim().min(1).max(500)
});

export const teamNoteDeleteSchema = z.object({ noteId: z.string().uuid() });

export const dailySessionCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.nativeEnum(DailyMode),
  turnDurationSeconds: z.number().int().min(30).max(900)
});

export const dailyEntrySchema = z
  .object({
    dailyId: z.string().uuid(),
    yesterday: z.string().trim().max(2000),
    today: z.string().trim().max(2000),
    mood: z.string().trim().max(12).optional().nullable(),
    blocker: z.string().trim().max(500).optional().nullable()
  })
  .refine((value) => Boolean(value.yesterday || value.today || value.blocker), "La actualizacion no puede estar vacia.");

export const dailyIdSchema = z.object({ dailyId: z.string().uuid() });
export const dailyBlockerResolveSchema = z.object({ blockerId: z.string().uuid() });
export const dailyActionCreateSchema = z.object({
  dailyId: z.string().uuid(),
  content: z.string().trim().min(1).max(500),
  assigneeName: z.string().trim().max(80).optional().nullable()
});
export const dailyActionToggleSchema = z.object({ actionId: z.string().uuid() });

export const createRoomSchema = z.object({
  roomName: roomNameSchema,
  participantName: participantNameSchema,
  firstStoryTitle: storyTitleSchema.optional().or(z.literal(""))
});

export const joinRoomSchema = z.object({
  roomCode: roomCodeSchema,
  participantName: participantNameSchema,
  role: roleSchema.default(ParticipantRole.VOTER)
});

export const reconnectSchema = z.object({
  roomCode: roomCodeSchema,
  sessionToken: z.string().min(24).max(256)
});

export const createStorySchema = z.object({
  title: storyTitleSchema,
  description: longTextSchema,
  acceptanceCriteria: longTextSchema
});

export const updateStorySchema = createStorySchema.partial();

export const reorderStoriesSchema = z.object({
  storyIds: z.array(z.string().uuid()).min(1)
});

export const voteSubmitSchema = z.object({
  roomCode: roomCodeSchema,
  storyId: z.string().uuid(),
  value: voteValueSchema
});

export const finalizeStorySchema = z.object({
  storyId: z.string().uuid(),
  finalEstimate: voteValueSchema
});

export interface ParticipantView {
  id: string;
  displayName: string;
  role: ParticipantRole;
  connected: boolean;
  hasVoted: boolean;
  joinedAt: string;
  lastActivityAt: string;
  availability: TeamAvailability;
  zone: TeamZone;
  activity: string | null;
  avatarId: TeamAvatarId | null;
  userId: string | null;
  positionX: number;
  positionY: number;
}

export interface UserView {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthSessionView {
  token: string;
  user: UserView;
}

export interface StoryView {
  id: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  position: number;
  status: StoryStatus;
  finalEstimate: string | null;
  source: string | null;
  externalId: string | null;
  ownerName: string | null;
  workflowStatus: string | null;
  taskType: string | null;
  originalEstimate: string | null;
}

export interface VoteStatusView {
  participantId: string;
  hasVoted: boolean;
  timestamp?: string;
}

export interface RevealedVoteView extends VoteStatusView {
  value: string;
}

export interface ChatMessageView {
  id: string;
  participantId: string;
  participantName: string;
  participantRole: ParticipantRole;
  content: string | null;
  gifUrl: string | null;
  gifTitle: string | null;
  createdAt: string;
}

export interface AvatarReactionView {
  id: string;
  participantId: string;
  participantName: string;
  emoji: string;
  createdAt: string;
}

export interface RoomCrashEvent {
  action: "boom" | "back";
  startsAt: number;
  countdown: number;
}

export interface TeamPositionEvent {
  participantId: string;
  x: number;
  y: number;
  zone: TeamZone;
  updatedAt: string;
}

export interface VoteStatistics {
  count: number;
  min: number | null;
  max: number | null;
  average: number | null;
  median: number | null;
  mode: number | null;
  distribution: Record<string, number>;
  consensus: number | null;
  hasQuestion: boolean;
  hasBreak: boolean;
  highSpread: boolean;
  lowConsensus: boolean;
}

export interface RoomStateView {
  room: {
    id: string;
    code: string;
    name: string;
    type: RoomType;
    status: RoomStatus;
    deck: string[];
    activeStoryId: string | null;
    currentRound: number;
    moderatorParticipantId: string | null;
    lastActivityAt: string;
  };
  me?: ParticipantView;
  participants: ParticipantView[];
  stories: StoryView[];
  votes: VoteStatusView[] | RevealedVoteView[];
  chatMessages: ChatMessageView[];
  reactions: AvatarReactionView[];
  statistics: VoteStatistics | null;
  history: Array<{
    storyId: string;
    storyTitle: string;
    round: number;
    finalEstimate: string | null;
    revealedAt: string | null;
    votes: RevealedVoteView[];
    statistics: VoteStatistics | null;
  }>;
  retrospective: RetrospectiveView | null;
  team: TeamRoomView | null;
  daily: DailySessionView | null;
}

export interface DailyEntryView {
  id: string;
  participantId: string;
  participantName: string;
  yesterday: string;
  today: string;
  mood: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface DailyBlockerView {
  id: string;
  dailyId: string;
  participantId: string;
  participantName: string;
  content: string;
  resolvedAt: string | null;
  resolvedById: string | null;
  createdAt: string;
  ageDays: number;
}

export interface DailyActionView {
  id: string;
  dailyId: string;
  content: string;
  assigneeName: string | null;
  completed: boolean;
  createdByName: string;
  createdAt: string;
}

export interface DailySessionView {
  id: string;
  date: string;
  mode: DailyMode;
  status: DailyStatus;
  currentParticipantId: string | null;
  currentTurnStartedAt: string | null;
  turnDurationSeconds: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMinutes: number | null;
  participationRate: number;
  entries: DailyEntryView[];
  blockers: DailyBlockerView[];
  actions: DailyActionView[];
}

export interface TeamRoomView {
  sessions: DailySessionView[];
  notes: TeamNoteView[];
  metrics: {
    participationRate: number;
    openBlockers: number;
    averageDailyMinutes: number | null;
    averageResolutionDays: number | null;
    recurringBlockers: Array<{ content: string; count: number }>;
  };
}

export interface TeamNoteView {
  id: string;
  participantId: string;
  participantName: string;
  avatarId: TeamAvatarId | null;
  content: string;
  createdAt: string;
  expiresAt: string;
  canDelete: boolean;
}

export interface RetroColumnView {
  id: string;
  title: string;
  color: string;
  position: number;
}

export interface RetroCardView {
  id: string;
  columnId: string;
  participantId: string | null;
  authorName: string | null;
  content: string;
  anonymous: boolean;
  position: number;
  voteCount: number;
  voterIds: string[];
  votedByMe: boolean;
  canEdit: boolean;
  comments: RetroCommentView[];
  reactions: RetroReactionView[];
  createdAt: string;
}

export interface RetroCommentView {
  id: string;
  participantId: string;
  participantName: string;
  content: string;
  createdAt: string;
}

export interface RetroReactionView {
  emoji: string;
  count: number;
  participantIds: string[];
}

export interface RetroActionView {
  id: string;
  cardId: string | null;
  content: string;
  assigneeName: string | null;
  completed: boolean;
  createdByName: string;
  createdAt: string;
}

export interface RetrospectiveView {
  columns: RetroColumnView[];
  cards: RetroCardView[];
  actions: RetroActionView[];
}

export interface StoryImportCandidate {
  title: string;
  description: string | null;
  source: string;
  externalId: string | null;
  ownerName: string | null;
  workflowStatus: string | null;
  taskType: string | null;
  originalEstimate: string | null;
}

export interface StoryImportResult {
  imported: number;
  skipped: number;
  detectedSource: string;
  headerRow: number;
  stories: StoryView[];
  warnings: string[];
}

export interface SessionSummaryVote {
  participantId: string;
  participantName: string;
  value: string;
  submittedAt: string;
}

export interface SessionSummaryRound {
  storyId: string;
  storyTitle: string;
  round: number;
  revealedAt: string | null;
  closedAt: string | null;
  votes: SessionSummaryVote[];
  statistics: VoteStatistics | null;
}

export interface SessionSummaryStory {
  id: string;
  title: string;
  status: StoryStatus;
  finalEstimate: string | null;
  ownerName: string | null;
  workflowStatus: string | null;
  taskType: string | null;
  originalEstimate: string | null;
  rounds: SessionSummaryRound[];
}

export interface SessionSummaryView {
  room: {
    code: string;
    name: string;
    status: RoomStatus;
    createdAt: string;
    closedAt: string | null;
  };
  participants: ParticipantView[];
  stories: SessionSummaryStory[];
  totals: {
    participants: number;
    voters: number;
    observers: number;
    stories: number;
    estimatedStories: number;
    rounds: number;
    votes: number;
  };
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details: unknown;
  timestamp: string;
}

export function calculateVoteStatistics(values: string[]): VoteStatistics {
  const numeric = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  const distribution = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  const sorted = [...numeric].sort((a, b) => a - b);
  const count = numeric.length;
  const min = count ? sorted[0] : null;
  const max = count ? sorted[sorted.length - 1] : null;
  const average = count ? Number((numeric.reduce((sum, value) => sum + value, 0) / count).toFixed(2)) : null;
  const median = count ? (sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null;
  const numericDistribution = numeric.reduce<Record<string, number>>((acc, value) => {
    const key = String(value);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const modeEntry = Object.entries(numericDistribution).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0];
  const mode = modeEntry ? Number(modeEntry[0]) : null;
  const consensus = count && modeEntry ? Number(((modeEntry[1] / count) * 100).toFixed(1)) : null;

  return {
    count,
    min,
    max,
    average,
    median,
    mode,
    distribution,
    consensus,
    hasQuestion: values.includes("?"),
    hasBreak: values.includes("BREAK"),
    highSpread: min !== null && max !== null ? max - min >= 8 : false,
    lowConsensus: consensus !== null ? consensus < 60 : false
  };
}
