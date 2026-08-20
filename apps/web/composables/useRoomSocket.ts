import { io, type Socket } from "socket.io-client";
import { ApiErrorCode, ClientEvents, ServerEvents, type ApiErrorBody, type ParticipantRole, type RoomCrashEvent, type RoomStateView, type TeamPositionEvent } from "@planning/shared";

interface SocketResponse {
  ok: boolean;
  data?: {
    sessionToken?: string;
    participantId?: string;
  };
  error?: ApiErrorBody;
}

let socket: Socket | null = null;

export function useRoomSocket(roomCode: string) {
  const config = useRuntimeConfig();
  const { showApiError } = useApiErrors();
  const roomStore = useRoomStore();
  const participantStore = useParticipantStore();
  const storiesStore = useStoriesStore();
  const votingStore = useVotingStore();
  const connectionStore = useConnectionStore();
  const session = useParticipantSession(roomCode);
  const recentRooms = useRecentRooms();

  function applyState(state: RoomStateView) {
    const previousRoom = roomStore.state?.room;
    const previousRetroCards = new Map(roomStore.state?.retrospective?.cards.map((card) => [card.id, card]) ?? []);
    if (state.retrospective) {
      state = {
        ...state,
        retrospective: {
          ...state.retrospective,
          cards: state.retrospective.cards.map((card) => ({
            ...card,
            canEdit: card.canEdit || previousRetroCards.get(card.id)?.canEdit === true
          }))
        }
      };
    }
    roomStore.setState(state);
    participantStore.setMe(state.me);
    storiesStore.setStories(state.stories);
    votingStore.setVoting(state.votes, state.statistics);
    recentRooms.rememberState(state);
    if (previousRoom && (previousRoom.activeStoryId !== state.room.activeStoryId || previousRoom.currentRound !== state.room.currentRound)) {
      votingStore.select(null);
    }
  }

  function connect() {
    if (socket?.connected) {
      return socket;
    }
    socket = io(config.public.socketUrl, {
      autoConnect: true,
      reconnection: true,
      withCredentials: true
    });

    socket.on("connect", () => {
      connectionStore.setConnected(true);
      const token = session.getToken();
      if (token) {
        emit(ClientEvents.ROOM_SYNC, { roomCode, sessionToken: token });
      }
    });
    socket.on("disconnect", () => connectionStore.setConnected(false));
    socket.on(ServerEvents.ERROR, (error: ApiErrorBody) => {
      connectionStore.setError(error.message);
      showApiError({ data: error });
    });
    socket.on(ServerEvents.ROOM_CRASH, (event: RoomCrashEvent) => {
      window.dispatchEvent(new CustomEvent<RoomCrashEvent>("planning-room-crash", { detail: event }));
    });
    socket.on(ServerEvents.TEAM_POSITION_UPDATED, (event: TeamPositionEvent) => roomStore.patchTeamPosition(event));

    const stateEvents = [
      ServerEvents.ROOM_STATE,
      ServerEvents.ROOM_UPDATED,
      ServerEvents.PARTICIPANT_JOINED,
      ServerEvents.PARTICIPANT_LEFT,
      ServerEvents.PARTICIPANT_UPDATED,
      ServerEvents.STORY_CREATED,
      ServerEvents.STORY_UPDATED,
      ServerEvents.STORY_DELETED,
      ServerEvents.STORY_REORDERED,
      ServerEvents.STORY_ACTIVATED,
      ServerEvents.STORY_FINALIZED,
      ServerEvents.VOTE_STATUS,
      ServerEvents.ROUND_REVEALED,
      ServerEvents.ROUND_RESTARTED,
      ServerEvents.ROOM_REOPENED,
      ServerEvents.CHAT_UPDATED,
      ServerEvents.REACTION_CREATED,
      ServerEvents.RETRO_UPDATED,
      ServerEvents.TEAM_UPDATED,
      ServerEvents.DAILY_UPDATED
    ];
    for (const event of stateEvents) {
      socket.on(event, (state: RoomStateView) => applyState(state));
    }

    return socket;
  }

  function emit(event: string, payload: Record<string, unknown>): Promise<SocketResponse> {
    const active = connect();
    return new Promise((resolve) => {
      active.timeout(5000).emit(event, payload, (err: Error | null, response: SocketResponse) => {
        if (err) {
          const message = "No se pudo conectar con la sala.";
          connectionStore.setError(message);
          const error = { code: ApiErrorCode.SOCKET_TIMEOUT, message, details: null, timestamp: new Date().toISOString() };
          showApiError({ data: error });
          resolve({ ok: false, error });
          return;
        }
        if (response?.error) {
          connectionStore.setError(response.error.message);
        }
        resolve(response);
      });
    });
  }

  function emitVolatile(event: string, payload: Record<string, unknown>) {
    connect().volatile.emit(event, payload);
  }

  async function join(participantName: string, role: ParticipantRole) {
    const response = await emit(ClientEvents.ROOM_JOIN, { roomCode, participantName, role });
    if (response.ok && response.data?.sessionToken) {
      session.setToken(response.data.sessionToken);
      participantStore.setSession(response.data.sessionToken);
    }
    return response;
  }

  async function sync() {
    const token = session.getToken();
    if (!token) {
      return false;
    }
    participantStore.setSession(token);
    const response = await emit(ClientEvents.ROOM_SYNC, { roomCode, sessionToken: token });
    return response.ok;
  }

  function withSession(payload: Record<string, unknown> = {}) {
    const token = participantStore.sessionToken ?? session.getToken();
    if (!token) {
      throw new Error("Missing session token");
    }
    return { roomCode, sessionToken: token, ...payload };
  }

  return {
    connect,
    join,
    sync,
    emit,
    emitVolatile,
    withSession
  };
}
