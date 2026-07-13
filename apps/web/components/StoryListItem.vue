<script setup lang="ts">
import type { StoryView } from "@planning/shared";

const props = defineProps<{ story: StoryView; active: boolean; canManage: boolean; dragging?: boolean }>();
defineEmits<{ activate: [string]; edit: [StoryView]; delete: [string]; skip: [string] }>();

const itemClasses = computed(() => {
  if (props.dragging) {
    return "border-teal-500 bg-teal-50 shadow-lg ring-2 ring-teal-400/60 dark:bg-teal-950/40";
  }
  if (props.active) {
    return "border-teal-500 bg-teal-50 shadow-sm ring-2 ring-teal-400/60 dark:bg-teal-950/30";
  }
  if (props.story.status === "ESTIMATED") {
    return "border-emerald-300 bg-emerald-50/90 dark:border-emerald-800 dark:bg-emerald-950/30";
  }
  if (props.story.status === "SKIPPED") {
    return "border-amber-300 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/30";
  }
  return "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";
});

const statusBadgeColor = computed(() => {
  if (props.active) return "teal";
  if (props.story.status === "ESTIMATED") return "green";
  if (props.story.status === "SKIPPED") return "amber";
  return "gray";
});
</script>

<template>
  <div class="rounded-md border-2 p-3 transition-[border-color,box-shadow,background-color,transform]" :class="itemClasses">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="flex min-w-0 items-center gap-2">
          <p class="truncate font-medium">{{ story.title }}</p>
          <UBadge v-if="active" size="xs" color="teal" variant="subtle">En trabajo</UBadge>
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <UBadge size="xs" :color="statusBadgeColor" variant="subtle">{{ story.status }}</UBadge>
          <span v-if="story.finalEstimate">Final: {{ story.finalEstimate }}</span>
        </div>
      </div>
      <div v-if="canManage" class="flex shrink-0 items-center gap-1">
        <UTooltip v-if="!active" text="Iniciar HDU">
          <UButton icon="i-lucide-play" color="teal" variant="soft" size="xs" aria-label="Iniciar HDU" @click="$emit('activate', story.id)" />
        </UTooltip>
        <UDropdown :items="[[{ label: 'Activar', icon: 'i-lucide-play', click: () => $emit('activate', story.id) }, { label: 'Editar', icon: 'i-lucide-pencil', click: () => $emit('edit', story) }, { label: 'Omitir', icon: 'i-lucide-skip-forward', click: () => $emit('skip', story.id) }, { label: 'Eliminar', icon: 'i-lucide-trash', click: () => $emit('delete', story.id) }]]">
          <UButton icon="i-lucide-more-vertical" color="gray" variant="ghost" size="xs" aria-label="Acciones de historia" />
        </UDropdown>
      </div>
    </div>
  </div>
</template>
