import { ClientEvents } from "@planning/shared";

interface GiphyGif {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
}

interface GiphySearchResponse {
  data: Array<{
    id: string;
    title: string;
    images: {
      fixed_height_small?: { url: string };
      downsized_medium?: { url: string };
      original?: { url: string };
    };
  }>;
}

export function useRoomChat(roomCode: string) {
  const socket = useRoomSocket(roomCode);
  const config = useRuntimeConfig();
  const { showApiError } = useApiErrors();

  async function emitChatEvent(event: string, payload: Record<string, unknown>) {
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

  function sendMessage(content: string, gif?: { url: string; title: string }) {
    return emitChatEvent(ClientEvents.CHAT_SEND, {
      data: {
        content,
        gifUrl: gif?.url ?? null,
        gifTitle: gif?.title ?? null
      }
    });
  }

  function sendReaction(emoji: string) {
    return emitChatEvent(ClientEvents.REACTION_SEND, { data: { emoji } });
  }

  async function searchGifs(query: string): Promise<GiphyGif[]> {
    const apiKey = String(config.public.giphyApiKey || "");
    if (!apiKey || !query.trim()) return [];
    const response = await $fetch<GiphySearchResponse>("https://api.giphy.com/v1/gifs/search", {
      query: { api_key: apiKey, q: query.trim(), limit: 8, rating: "g", lang: "es" }
    });
    return response.data.flatMap((gif) => {
      const url = gif.images.downsized_medium?.url ?? gif.images.original?.url;
      const previewUrl = gif.images.fixed_height_small?.url ?? url;
      if (!url || !previewUrl) return [];
      return [{ id: gif.id, title: gif.title || "GIF", url, previewUrl }];
    });
  }

  return { sendMessage, sendReaction, searchGifs, giphyEnabled: computed(() => Boolean(config.public.giphyApiKey)) };
}
