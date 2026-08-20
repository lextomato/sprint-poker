import { ClientEvents, type DailyMode, type TeamAvailability, type TeamAvatarId, type TeamZone } from "@planning/shared";

export function useTeam(roomCode: string) {
  const socket = useRoomSocket(roomCode);
  const { showApiError } = useApiErrors();

  async function send(event: string, payload: Record<string, unknown> = {}) {
    try {
      const response = await socket.emit(event, socket.withSession(payload));
      if (!response.ok && response.error) showApiError({ data: response.error });
      if (response.ok) await socket.sync();
      return response.ok;
    } catch (error) {
      showApiError(error, "No se pudo actualizar el equipo");
      return false;
    }
  }

  return {
    updatePresence: (availability: TeamAvailability, zone: TeamZone, activity?: string | null, avatarId?: TeamAvatarId) =>
      send(ClientEvents.TEAM_PRESENCE_UPDATE, { data: { availability, zone, activity, avatarId } }),
    updatePosition: (x: number, y: number, zone: TeamZone) => {
      try {
        socket.emitVolatile(ClientEvents.TEAM_POSITION_UPDATE, socket.withSession({ data: { x, y, zone } }));
        return true;
      } catch (error) {
        showApiError(error, "No se pudo actualizar la posicion");
        return false;
      }
    },
    createNote: (content: string) => send(ClientEvents.TEAM_NOTE_CREATE, { data: { content } }),
    deleteNote: (noteId: string) => send(ClientEvents.TEAM_NOTE_DELETE, { noteId }),
    createDaily: (date: string, mode: DailyMode, turnDurationSeconds: number) =>
      send(ClientEvents.DAILY_SESSION_CREATE, { data: { date, mode, turnDurationSeconds } }),
    saveEntry: (dailyId: string, yesterday: string, today: string, mood?: string | null, blocker?: string | null) =>
      send(ClientEvents.DAILY_ENTRY_UPSERT, { data: { dailyId, yesterday, today, mood, blocker } }),
    resolveBlocker: (blockerId: string) => send(ClientEvents.DAILY_BLOCKER_RESOLVE, { blockerId }),
    createAction: (dailyId: string, content: string, assigneeName?: string | null) =>
      send(ClientEvents.DAILY_ACTION_CREATE, { data: { dailyId, content, assigneeName } }),
    toggleAction: (actionId: string) => send(ClientEvents.DAILY_ACTION_TOGGLE, { actionId }),
    startDaily: (dailyId: string) => send(ClientEvents.DAILY_START, { dailyId }),
    nextParticipant: (dailyId: string) => send(ClientEvents.DAILY_NEXT, { dailyId }),
    completeDaily: (dailyId: string) => send(ClientEvents.DAILY_COMPLETE, { dailyId })
  };
}
