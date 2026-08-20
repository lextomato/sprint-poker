<script setup lang="ts">
import type { RetroCardView, RetroColumnView } from "@planning/shared";

const props = defineProps<{
  columns: RetroColumnView[];
  cards: RetroCardView[];
  canContribute: boolean;
  currentParticipantId?: string | null;
  moderatorId?: string | null;
  closed?: boolean;
}>();

const emit = defineEmits<{
  create: [columnId: string, content: string, anonymous: boolean];
  update: [cardId: string, content: string];
  delete: [cardId: string];
  move: [cardId: string, columnId: string, position: number];
  vote: [cardId: string];
  comment: [cardId: string, content: string];
  deleteComment: [commentId: string];
  reaction: [cardId: string, emoji: string];
  action: [card: RetroCardView];
}>();

const drafts = reactive<Record<string, string>>({});
const anonymous = reactive<Record<string, boolean>>({});
const openComposer = ref<string | null>(null);
const editingId = ref<string | null>(null);
const editingContent = ref("");
const draggingId = ref<string | null>(null);
const dragOverColumn = ref<string | null>(null);

const columnStyles: Record<string, { dot: string; band: string }> = {
  emerald: { dot: "bg-emerald-500", band: "border-t-emerald-500" },
  rose: { dot: "bg-rose-500", band: "border-t-rose-500" },
  amber: { dot: "bg-amber-500", band: "border-t-amber-500" }
};

function cardsFor(columnId: string) {
  return props.cards.filter((card) => card.columnId === columnId).sort((a, b) => a.position - b.position);
}

function submit(columnId: string) {
  const content = drafts[columnId]?.trim();
  if (!content) return;
  emit("create", columnId, content, Boolean(anonymous[columnId]));
  drafts[columnId] = "";
  anonymous[columnId] = false;
  openComposer.value = null;
}

function startEdit(card: RetroCardView) {
  editingId.value = card.id;
  editingContent.value = card.content;
}

function saveEdit(cardId: string) {
  const content = editingContent.value.trim();
  if (content) emit("update", cardId, content);
  editingId.value = null;
}

function canEdit(card: RetroCardView) {
  return card.canEdit || card.participantId === props.currentParticipantId || props.currentParticipantId === props.moderatorId;
}

function votedByMe(card: RetroCardView) {
  return Boolean(props.currentParticipantId && card.voterIds.includes(props.currentParticipantId));
}

function drop(columnId: string) {
  const cardId = draggingId.value;
  if (cardId) emit("move", cardId, columnId, cardsFor(columnId).length + 1);
  draggingId.value = null;
  dragOverColumn.value = null;
}
</script>

<template>
  <div class="grid min-w-[820px] grid-cols-3 gap-3">
    <section v-for="column in columns" :key="column.id" class="flex min-h-[62vh] flex-col rounded-lg border border-t-4 border-gray-200 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-900/70" :class="[columnStyles[column.color]?.band, dragOverColumn === column.id ? 'ring-2 ring-teal-400 ring-offset-2 dark:ring-offset-gray-950' : '']" @dragover.prevent="dragOverColumn = column.id" @dragleave.self="dragOverColumn = null" @drop.prevent="drop(column.id)">
      <div class="mb-3 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :class="columnStyles[column.color]?.dot" />
          <h2 class="font-semibold text-gray-900 dark:text-white">{{ column.title }}</h2>
          <UBadge color="gray" variant="subtle" size="xs">{{ cardsFor(column.id).length }}</UBadge>
        </div>
        <UButton v-if="canContribute && !closed" icon="i-lucide-plus" color="gray" variant="ghost" size="xs" :aria-label="`Añadir en ${column.title}`" @click="openComposer = openComposer === column.id ? null : column.id" />
      </div>

      <div v-if="openComposer === column.id" class="mb-3 rounded-md border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-950">
        <UTextarea v-model="drafts[column.id]" :rows="3" :placeholder="`Escribe una idea para ${column.title.toLowerCase()}`" maxlength="1000" autofocus @keydown.ctrl.enter="submit(column.id)" />
        <div class="mt-2 flex items-center justify-between gap-2">
          <UCheckbox v-model="anonymous[column.id]" label="Anónima" />
          <div class="flex gap-1">
            <UButton icon="i-lucide-x" color="gray" variant="ghost" size="xs" aria-label="Cancelar" @click="openComposer = null" />
            <UButton icon="i-lucide-send" color="teal" size="xs" :disabled="!drafts[column.id]?.trim()" @click="submit(column.id)">Publicar</UButton>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <article v-for="card in cardsFor(column.id)" :key="card.id" draggable="true" class="group rounded-md border border-gray-200 bg-white p-3 shadow-sm transition hover:border-gray-300 hover:shadow dark:border-gray-700 dark:bg-gray-950 dark:hover:border-gray-600" :class="draggingId === card.id ? 'opacity-50' : ''" @dragstart="draggingId = card.id" @dragend="draggingId = null; dragOverColumn = null">
          <template v-if="editingId === card.id">
            <UTextarea v-model="editingContent" :rows="3" maxlength="1000" autofocus />
            <div class="mt-2 flex justify-end gap-1"><UButton icon="i-lucide-x" color="gray" variant="ghost" size="xs" @click="editingId = null" /><UButton icon="i-lucide-check" color="teal" size="xs" @click="saveEdit(card.id)" /></div>
          </template>
          <template v-else>
            <p class="whitespace-pre-wrap text-sm leading-5 text-gray-800 dark:text-gray-100">{{ card.content }}</p>
            <div class="mt-3 flex items-center justify-between gap-2">
              <div class="flex min-w-0 items-center gap-2 text-xs text-gray-500">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 font-semibold dark:bg-gray-800">{{ card.anonymous ? '?' : card.authorName?.slice(0, 2).toUpperCase() }}</span>
                <span class="truncate">{{ card.anonymous ? "Anónimo" : card.authorName }}</span>
              </div>
              <div class="flex items-center gap-1">
                <UButton icon="i-lucide-thumbs-up" :color="votedByMe(card) ? 'teal' : 'gray'" :variant="votedByMe(card) ? 'soft' : 'ghost'" size="xs" :disabled="!canContribute || closed" @click="emit('vote', card.id)">{{ card.voteCount }}</UButton>
                <UButton v-if="canContribute && !closed" icon="i-lucide-list-plus" color="gray" variant="ghost" size="xs" aria-label="Crear acción" @click="emit('action', card)" />
                <UDropdown v-if="canEdit(card) && !closed" :items="[[{ label: 'Editar', icon: 'i-lucide-pencil', click: () => startEdit(card) }, { label: 'Eliminar', icon: 'i-lucide-trash-2', click: () => emit('delete', card.id) }]]">
                  <UButton icon="i-lucide-more-vertical" color="gray" variant="ghost" size="xs" aria-label="Opciones" />
                </UDropdown>
              </div>
            </div>
            <RetroCardDiscussion
              :card="card"
              :can-contribute="canContribute"
              :current-participant-id="currentParticipantId"
              :moderator-id="moderatorId"
              :closed="closed"
              @comment="(cardId: string, content: string) => emit('comment', cardId, content)"
              @delete-comment="(commentId: string) => emit('deleteComment', commentId)"
              @reaction="(cardId: string, emoji: string) => emit('reaction', cardId, emoji)"
            />
          </template>
        </article>
      </div>

      <button v-if="canContribute && !closed && openComposer !== column.id" class="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500 hover:border-teal-400 hover:text-teal-700 dark:border-gray-700 dark:hover:border-teal-600 dark:hover:text-teal-300" @click="openComposer = column.id"><UIcon name="i-lucide-plus" class="h-4 w-4" />Añadir tarjeta</button>
    </section>
  </div>
</template>
