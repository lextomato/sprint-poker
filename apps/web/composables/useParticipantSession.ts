export function useParticipantSession(roomCode: string) {
  const key = `planning_session_${roomCode}`;

  function getToken() {
    if (import.meta.server) {
      return null;
    }
    return window.localStorage.getItem(key);
  }

  function setToken(token: string) {
    if (import.meta.client) {
      window.localStorage.setItem(key, token);
    }
  }

  function clearToken() {
    if (import.meta.client) {
      window.localStorage.removeItem(key);
    }
  }

  return { getToken, setToken, clearToken };
}
