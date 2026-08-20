import { ClientEvents } from "@planning/shared";

export function useRetrospective(roomCode: string) {
  const socket = useRoomSocket(roomCode);
  const { showApiError } = useApiErrors();

  async function send(event: string, payload: Record<string, unknown>) {
    try {
      const response = await socket.emit(event, socket.withSession(payload));
      if (!response.ok && response.error) showApiError({ data: response.error });
      if (response.ok) await socket.sync();
      return response.ok;
    } catch (error) {
      showApiError(error, "No se pudo actualizar la retrospectiva");
      return false;
    }
  }

  return {
    createCard: (columnId: string, content: string, anonymous: boolean) => send(ClientEvents.RETRO_CARD_CREATE, { data: { columnId, content, anonymous } }),
    updateCard: (cardId: string, content: string) => send(ClientEvents.RETRO_CARD_UPDATE, { cardId, content }),
    deleteCard: (cardId: string) => send(ClientEvents.RETRO_CARD_DELETE, { cardId }),
    moveCard: (cardId: string, columnId: string, position: number) => send(ClientEvents.RETRO_CARD_MOVE, { cardId, columnId, position }),
    toggleVote: (cardId: string) => send(ClientEvents.RETRO_VOTE_TOGGLE, { cardId }),
    createComment: (cardId: string, content: string) => send(ClientEvents.RETRO_COMMENT_CREATE, { cardId, content }),
    deleteComment: (commentId: string) => send(ClientEvents.RETRO_COMMENT_DELETE, { commentId }),
    toggleReaction: (cardId: string, emoji: string) => send(ClientEvents.RETRO_REACTION_TOGGLE, { cardId, emoji }),
    createAction: (content: string, assigneeName?: string | null, cardId?: string | null) => send(ClientEvents.RETRO_ACTION_CREATE, { data: { content, assigneeName, cardId } }),
    toggleAction: (actionId: string) => send(ClientEvents.RETRO_ACTION_TOGGLE, { actionId }),
    deleteAction: (actionId: string) => send(ClientEvents.RETRO_ACTION_DELETE, { actionId })
  };
}
