<script setup lang="ts">
import type { RetroActionView } from "@planning/shared";

defineProps<{ actions: RetroActionView[]; canContribute: boolean; closed?: boolean; canManage?: boolean }>();
defineEmits<{ create: []; toggle: [string]; delete: [string] }>();
</script>

<template>
  <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div class="mb-3 flex items-center justify-between">
      <div>
        <h2 class="font-semibold text-gray-950 dark:text-white">Acuerdos de acción</h2>
        <p class="text-xs text-gray-500">Compromisos que salen de esta retrospectiva</p>
      </div>
      <UButton v-if="canContribute && !closed" icon="i-lucide-plus" color="teal" variant="soft" size="sm" @click="$emit('create')">Nueva acción</UButton>
    </div>
    <EmptyState v-if="actions.length === 0" icon="i-lucide-list-checks" title="Aún no hay acciones" />
    <div v-else class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <div v-for="action in actions" :key="action.id" class="flex items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
        <UCheckbox :model-value="action.completed" :disabled="!canContribute || closed" class="mt-0.5" @update:model-value="$emit('toggle', action.id)" />
        <div class="min-w-0 flex-1">
          <p class="text-sm text-gray-800 dark:text-gray-100" :class="action.completed ? 'line-through opacity-60' : ''">{{ action.content }}</p>
          <p class="mt-1 text-xs text-gray-500">{{ action.assigneeName || 'Sin responsable' }} · {{ action.createdByName }}</p>
        </div>
        <UButton v-if="canManage && !closed" icon="i-lucide-trash-2" color="gray" variant="ghost" size="xs" aria-label="Eliminar acción" @click="$emit('delete', action.id)" />
      </div>
    </div>
  </section>
</template>
