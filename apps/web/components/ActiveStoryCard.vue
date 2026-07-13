<script setup lang="ts">
import type { StoryView } from "@planning/shared";
import type { RoomStatus } from "@planning/shared";

defineProps<{ story: StoryView | null; round: number; status: RoomStatus }>();
</script>

<template>
  <section class="rounded-lg border border-gray-200 bg-white/90 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
    <div v-if="story" class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold">{{ story.title }}</h1>
          <div class="mt-2 flex items-center gap-2">
            <RoomStatusBadge :status="status" />
            <UBadge color="gray" variant="subtle">Ronda {{ round }}</UBadge>
          </div>
        </div>
      </div>
      <p v-if="story.description" class="whitespace-pre-wrap text-gray-700 dark:text-gray-200">{{ story.description }}</p>
      <div v-if="story.acceptanceCriteria" class="rounded-md bg-gray-50 p-4 text-sm dark:bg-gray-800">
        <h2 class="mb-2 font-medium">Criterios</h2>
        <p class="whitespace-pre-wrap">{{ story.acceptanceCriteria }}</p>
      </div>
    </div>
    <EmptyState v-else icon="i-lucide-pointer" title="Selecciona una historia" />
  </section>
</template>
