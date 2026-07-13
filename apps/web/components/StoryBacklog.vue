<script setup lang="ts">
import draggable from "vuedraggable";
import type { StoryView } from "@planning/shared";

const props = defineProps<{ stories: StoryView[]; activeStoryId: string | null; canManage: boolean; collapsible?: boolean }>();
const emit = defineEmits<{ add: []; import: [File]; activate: [string]; edit: [StoryView]; delete: [string]; skip: [string]; reorder: [string[]]; collapse: [] }>();

const localStories = ref<StoryView[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const draggingStoryId = ref<string | null>(null);
watch(
  () => props.stories,
  (stories) => {
    localStories.value = [...stories].sort((a, b) => a.position - b.position);
  },
  { immediate: true }
);

function onStart(event: { item?: HTMLElement }) {
  draggingStoryId.value = event.item?.dataset.storyId ?? null;
}

function onEnd() {
  draggingStoryId.value = null;
  emit(
    "reorder",
    localStories.value.map((story) => story.id)
  );
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    emit("import", file);
    input.value = "";
  }
}
</script>

<template>
  <aside class="rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Backlog</h2>
      <div class="flex gap-1">
        <UButton v-if="collapsible" icon="i-lucide-panel-left-close" color="gray" variant="ghost" size="xs" aria-label="Minimizar backlog" @click="$emit('collapse')" />
        <UButton v-if="canManage" icon="i-lucide-upload" color="gray" variant="soft" size="xs" aria-label="Importar historias" @click="fileInput?.click()" />
        <UButton v-if="canManage" icon="i-lucide-plus" color="teal" size="xs" aria-label="Agregar historia" @click="$emit('add')" />
      </div>
    </div>
    <input ref="fileInput" class="hidden" type="file" accept=".xlsx,.xls,.csv,.tsv" @change="onFileSelected" />
    <div class="max-h-[calc(100vh-11rem)] min-h-0 overflow-y-auto pr-1">
      <draggable v-model="localStories" item-key="id" handle=".drag-handle" :disabled="!canManage" class="space-y-2" ghost-class="story-drop-preview" chosen-class="story-drag-chosen" drag-class="story-dragging" @start="onStart" @end="onEnd">
        <template #item="{ element }">
          <div class="story-draggable-row flex gap-2" :data-story-id="element.id">
            <button v-if="canManage" class="drag-handle mt-3 text-gray-400" aria-label="Reordenar historia">
              <UIcon name="i-lucide-grip-vertical" class="h-4 w-4" />
            </button>
            <StoryListItem class="min-w-0 flex-1" :story="element" :active="element.id === activeStoryId" :dragging="element.id === draggingStoryId" :can-manage="canManage" @activate="$emit('activate', $event)" @edit="$emit('edit', $event)" @delete="$emit('delete', $event)" @skip="$emit('skip', $event)" />
          </div>
        </template>
      </draggable>
      <EmptyState v-if="localStories.length === 0" icon="i-lucide-list-plus" title="Sin historias" />
    </div>
  </aside>
</template>
