<script setup lang="ts">
import type { SessionSummaryView } from "@planning/shared";

defineProps<{ summary: SessionSummaryView | null }>();
const model = defineModel<boolean>({ required: true });
defineEmits<{ downloadCsv: []; downloadXlsx: [] }>();
</script>

<template>
  <UModal v-model="model" :ui="{ width: 'w-full sm:max-w-6xl' }">
    <UCard class="max-h-[88vh] overflow-y-auto">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">Resumen de sesión</h2>
            <p v-if="summary" class="text-sm text-gray-500">{{ summary.room.name }} · {{ summary.room.code }}</p>
          </div>
          <div class="flex gap-2">
            <UButton icon="i-lucide-file-text" color="gray" variant="soft" :disabled="!summary" @click="$emit('downloadCsv')">CSV</UButton>
            <UButton icon="i-lucide-file-spreadsheet" color="teal" variant="soft" :disabled="!summary" @click="$emit('downloadXlsx')">Excel</UButton>
          </div>
        </div>
      </template>

      <div v-if="summary" class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-4">
          <UCard :ui="{ body: { padding: 'p-3 sm:p-3' } }"><div class="text-xs text-gray-500">Participantes</div><div class="text-xl font-semibold">{{ summary.totals.participants }}</div></UCard>
          <UCard :ui="{ body: { padding: 'p-3 sm:p-3' } }"><div class="text-xs text-gray-500">Historias</div><div class="text-xl font-semibold">{{ summary.totals.stories }}</div></UCard>
          <UCard :ui="{ body: { padding: 'p-3 sm:p-3' } }"><div class="text-xs text-gray-500">Estimadas</div><div class="text-xl font-semibold">{{ summary.totals.estimatedStories }}</div></UCard>
          <UCard :ui="{ body: { padding: 'p-3 sm:p-3' } }"><div class="text-xs text-gray-500">Votos</div><div class="text-xl font-semibold">{{ summary.totals.votes }}</div></UCard>
        </div>

        <div class="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
          <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800">
              <tr>
                <th class="px-3 py-2">Historia</th>
                <th class="px-3 py-2">Estado</th>
                <th class="px-3 py-2">Final</th>
                <th class="px-3 py-2">Rondas</th>
                <th class="px-3 py-2">Consenso</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
              <tr v-for="story in summary.stories" :key="story.id">
                <td class="max-w-md px-3 py-2">{{ story.title }}</td>
                <td class="px-3 py-2">{{ story.workflowStatus ?? story.status }}</td>
                <td class="px-3 py-2 font-medium">{{ story.finalEstimate ?? "-" }}</td>
                <td class="px-3 py-2">{{ story.rounds.length }}</td>
                <td class="px-3 py-2">{{ story.rounds.at(-1)?.statistics?.consensus ?? "-" }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </UCard>
  </UModal>
</template>
