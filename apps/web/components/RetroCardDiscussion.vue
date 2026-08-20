<script setup lang="ts">
import type { RetroCardView } from "@planning/shared";

const props = defineProps<{
  card: RetroCardView;
  canContribute: boolean;
  currentParticipantId?: string | null;
  moderatorId?: string | null;
  closed?: boolean;
}>();

const emit = defineEmits<{
  comment: [cardId: string, content: string];
  deleteComment: [commentId: string];
  reaction: [cardId: string, emoji: string];
}>();

const quickReactions = ["👍", "❤️", "🎉", "🤔", "👀"];
const commentsOpen = ref(false);
const draft = ref("");

function submitComment() {
  const content = draft.value.trim();
  if (!content) return;
  emit("comment", props.card.id, content);
  draft.value = "";
}

function reactedByMe(participantIds: string[]) {
  return Boolean(props.currentParticipantId && participantIds.includes(props.currentParticipantId));
}

function canDeleteComment(participantId: string) {
  return participantId === props.currentParticipantId || props.currentParticipantId === props.moderatorId;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
</script>

<template>
  <div class="mt-3 border-t border-gray-100 pt-2 dark:border-gray-800">
    <div class="flex flex-wrap items-center gap-1">
      <UButton
        v-for="reaction in card.reactions"
        :key="reaction.emoji"
        :color="reactedByMe(reaction.participantIds) ? 'teal' : 'gray'"
        :variant="reactedByMe(reaction.participantIds) ? 'soft' : 'ghost'"
        size="xs"
        :disabled="!canContribute || closed"
        :aria-label="`Reaccionar con ${reaction.emoji}`"
        @click="$emit('reaction', card.id, reaction.emoji)"
      >
        {{ reaction.emoji }} {{ reaction.count }}
      </UButton>

      <UPopover v-if="canContribute && !closed" :popper="{ placement: 'bottom-start' }">
        <UButton icon="i-lucide-smile-plus" color="gray" variant="ghost" size="xs" aria-label="Añadir reacción" />
        <template #panel>
          <div class="flex gap-1 p-2">
            <button v-for="emoji in quickReactions" :key="emoji" class="rounded-md p-1.5 text-lg hover:bg-gray-100 dark:hover:bg-gray-800" :aria-label="`Reaccionar con ${emoji}`" @click="$emit('reaction', card.id, emoji)">{{ emoji }}</button>
          </div>
        </template>
      </UPopover>

      <UButton icon="i-lucide-message-circle" color="gray" variant="ghost" size="xs" :aria-label="`${card.comments.length} comentarios`" @click="commentsOpen = !commentsOpen">
        {{ card.comments.length }}
      </UButton>
    </div>

    <div v-if="commentsOpen" class="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
      <p v-if="card.comments.length === 0" class="py-2 text-center text-xs text-gray-500">Sin comentarios todavía</p>
      <div v-else class="max-h-40 space-y-2 overflow-y-auto pr-1">
        <div v-for="comment in card.comments" :key="comment.id" class="group/comment text-xs">
          <div class="flex items-center justify-between gap-2 text-gray-500">
            <span class="truncate font-medium text-gray-700 dark:text-gray-200">{{ comment.participantName }}</span>
            <div class="flex shrink-0 items-center gap-1">
              <span>{{ timeLabel(comment.createdAt) }}</span>
              <UButton v-if="canDeleteComment(comment.participantId) && !closed" icon="i-lucide-x" color="red" variant="ghost" size="2xs" aria-label="Eliminar comentario" @click="$emit('deleteComment', comment.id)" />
            </div>
          </div>
          <p class="mt-0.5 whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">{{ comment.content }}</p>
        </div>
      </div>

      <div v-if="canContribute && !closed" class="mt-2 flex gap-1">
        <UInput v-model="draft" class="min-w-0 flex-1" size="xs" maxlength="500" placeholder="Escribe un comentario" @keyup.enter="submitComment" />
        <UButton icon="i-lucide-send" color="teal" size="xs" :disabled="!draft.trim()" aria-label="Enviar comentario" @click="submitComment" />
      </div>
    </div>
  </div>
</template>
