import { ClientEvents } from "@planning/shared";

export function useRoomLifecycle(roomCode: string) {
  const socket = useRoomSocket(roomCode);
  const { showApiError } = useApiErrors();

  async function reopenSession() {
    try {
      const response = await socket.emit(ClientEvents.ROOM_REOPEN, socket.withSession());
      if (!response.ok) {
        if (response.error) showApiError({ data: response.error });
        return false;
      }
      return true;
    } catch (error) {
      showApiError(error, "No se pudo reabrir la sesion");
      return false;
    }
  }

  return { reopenSession };
}
