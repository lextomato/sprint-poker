import type { ParticipantRole } from "@planning/shared";

export function useRoom(roomCode: string) {
  const socket = useRoomSocket(roomCode);
  const roomStore = useRoomStore();
  const participantStore = useParticipantStore();

  async function joinRoom(name: string, role: ParticipantRole) {
    return socket.join(name, role);
  }

  async function reconnect() {
    socket.connect();
    return socket.sync();
  }

  return {
    roomStore,
    participantStore,
    joinRoom,
    reconnect
  };
}
