import { ClientEvents } from "@planning/shared";

export function useVoting(roomCode: string) {
  const socket = useRoomSocket(roomCode);
  const votingStore = useVotingStore();
  const { showApiError } = useApiErrors();

  async function emitVotingEvent(event: string, payload: Record<string, unknown> = {}) {
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

  async function submitVote(storyId: string, value: string) {
    votingStore.select(value);
    const ok = await emitVotingEvent(ClientEvents.VOTE_SUBMIT, { storyId, value });
    if (!ok) votingStore.select(null);
    return ok;
  }

  function clearVote() {
    votingStore.select(null);
    return emitVotingEvent(ClientEvents.VOTE_CLEAR);
  }

  function revealRound() {
    return emitVotingEvent(ClientEvents.ROUND_REVEAL);
  }

  function restartRound() {
    votingStore.select(null);
    return emitVotingEvent(ClientEvents.ROUND_RESTART);
  }

  return { submitVote, clearVote, revealRound, restartRound };
}
