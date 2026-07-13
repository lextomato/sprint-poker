import type { RoomStateView, RoomStatus } from "@planning/shared";

export interface RecentRoom {
  code: string;
  name: string;
  status: RoomStatus;
  participantName: string | null;
  lastSeenAt: string;
}

const recentRoomsKey = "planning_recent_rooms";
const maxRecentRooms = 8;

function isRecentRoom(value: unknown): value is RecentRoom {
  return typeof value === "object" && value !== null && "code" in value && "name" in value && "status" in value && "lastSeenAt" in value;
}

function readRecentRooms(): RecentRoom[] {
  if (import.meta.server) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentRoomsKey) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRecentRoom) : [];
  } catch {
    return [];
  }
}

function writeRecentRooms(rooms: RecentRoom[]) {
  if (import.meta.client) {
    window.localStorage.setItem(recentRoomsKey, JSON.stringify(rooms.slice(0, maxRecentRooms)));
  }
}

export function useRecentRooms() {
  const rooms = useState<RecentRoom[]>("recent-rooms", () => []);

  function load() {
    rooms.value = readRecentRooms();
    return rooms.value;
  }

  function remember(room: Omit<RecentRoom, "lastSeenAt">) {
    const next: RecentRoom = { ...room, code: room.code.toUpperCase(), lastSeenAt: new Date().toISOString() };
    rooms.value = [next, ...readRecentRooms().filter((item) => item.code !== next.code)].slice(0, maxRecentRooms);
    writeRecentRooms(rooms.value);
  }

  function rememberState(state: RoomStateView) {
    remember({
      code: state.room.code,
      name: state.room.name,
      status: state.room.status,
      participantName: state.me?.displayName ?? null
    });
  }

  function forget(code: string) {
    rooms.value = readRecentRooms().filter((room) => room.code !== code.toUpperCase());
    writeRecentRooms(rooms.value);
  }

  function hasSession(code: string) {
    return Boolean(useParticipantSession(code).getToken());
  }

  return { rooms, load, remember, rememberState, forget, hasSession };
}
