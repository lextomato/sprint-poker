<script setup lang="ts">
import type { ParticipantView } from "@planning/shared";

defineProps<{ participants: ParticipantView[]; moderatorId: string | null; canManage?: boolean; currentParticipantId?: string | null }>();
defineEmits<{ changeRole: [string, "VOTER" | "OBSERVER"]; remove: [string] }>();
</script>

<template>
  <aside class="rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Participantes</h2>
      <UBadge color="gray" variant="subtle">{{ participants.length }}</UBadge>
    </div>
    <ul class="space-y-1">
      <ParticipantItem v-for="participant in participants" :key="participant.id" :participant="participant" :moderator-id="moderatorId" :can-manage="canManage" :current-participant-id="currentParticipantId" @change-role="(id, role) => $emit('changeRole', id, role)" @remove="$emit('remove', $event)" />
    </ul>
  </aside>
</template>
