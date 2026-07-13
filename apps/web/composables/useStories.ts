import { ClientEvents, type StoryView } from "@planning/shared";

export function useStories(roomCode: string) {
  const socket = useRoomSocket(roomCode);
  const config = useRuntimeConfig();
  const participantStore = useParticipantStore();
  const { showApiError } = useApiErrors();

  async function emitStoryEvent(event: string, payload: Record<string, unknown> = {}) {
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

  function createStory(data: { title: string; description?: string; acceptanceCriteria?: string }) {
    return emitStoryEvent(ClientEvents.STORY_CREATE, { data });
  }

  function updateStory(storyId: string, data: Partial<Pick<StoryView, "title" | "description" | "acceptanceCriteria">>) {
    return emitStoryEvent(ClientEvents.STORY_UPDATE, { storyId, data });
  }

  function deleteStory(storyId: string) {
    return emitStoryEvent(ClientEvents.STORY_DELETE, { storyId });
  }

  function activateStory(storyId: string) {
    return emitStoryEvent(ClientEvents.STORY_ACTIVATE, { storyId });
  }

  function skipStory(storyId: string) {
    return emitStoryEvent(ClientEvents.STORY_SKIP, { storyId });
  }

  function reorderStories(storyIds: string[]) {
    return emitStoryEvent(ClientEvents.STORY_REORDER, { storyIds });
  }

  function finalizeStory(storyId: string, finalEstimate: string) {
    return emitStoryEvent(ClientEvents.STORY_FINALIZE, { storyId, finalEstimate });
  }

  async function importStories(file: File) {
    const token = participantStore.sessionToken ?? useParticipantSession(roomCode).getToken();
    if (!token) {
      throw new Error("Missing session token");
    }
    const formData = new FormData();
    formData.append("file", file);
    const result = await $fetch<{ imported: number; skipped: number; warnings: string[] }>(`/rooms/${roomCode}/stories/import`, {
      baseURL: config.public.apiBaseUrl,
      method: "POST",
      headers: { "x-session-token": token },
      body: formData
    });
    await socket.sync();
    return result;
  }

  return { createStory, updateStory, deleteStory, activateStory, skipStory, reorderStories, finalizeStory, importStories };
}
