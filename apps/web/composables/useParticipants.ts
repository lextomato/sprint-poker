import { ClientEvents } from "@planning/shared";

export function useParticipants(roomCode: string) {
  const socket = useRoomSocket(roomCode);
  const { showApiError } = useApiErrors();

  async function emitParticipantEvent(event: string, payload: Record<string, unknown>) {
    try {
      const response = await socket.emit(event, socket.withSession(payload));
      if (!response.ok) {
        if (response.error) showApiError({ data: response.error });
        return false;
      }
      return true;
    } catch (error) {
      showApiError(error);
      return false;
    }
  }

  function updateRole(participantId: string, role: "VOTER" | "OBSERVER") {
    return emitParticipantEvent(ClientEvents.PARTICIPANT_UPDATE, { participantId, role });
  }

  function removeParticipant(participantId: string) {
    return emitParticipantEvent(ClientEvents.PARTICIPANT_REMOVE, { participantId });
  }

  return { updateRole, removeParticipant };
}
