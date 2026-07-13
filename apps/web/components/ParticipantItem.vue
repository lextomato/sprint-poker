<script setup lang="ts">
import type { ParticipantView } from "@planning/shared";

const props = defineProps<{ participant: ParticipantView; moderatorId: string | null; canManage?: boolean; currentParticipantId?: string | null }>();
defineEmits<{ changeRole: [string, "VOTER" | "OBSERVER"]; remove: [string] }>();

const initials = computed(() =>
  props.participant.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
);

const canModerateParticipant = computed(() => props.canManage && props.participant.id !== props.currentParticipantId && props.participant.id !== props.moderatorId);
</script>

<template>
  <li class="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
    <div class="flex min-w-0 items-center gap-3">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800 dark:bg-teal-900 dark:text-teal-100">
        {{ initials }}
      </div>
      <div class="min-w-0">
      <div class="flex items-center gap-2">
        <span class="truncate font-medium">{{ participant.displayName }}</span>
        <UIcon v-if="participant.id === moderatorId" name="i-lucide-shield" class="h-4 w-4 text-amber-500" />
      </div>
      <div class="text-xs text-gray-500">{{ participant.role }}</div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <UIcon v-if="participant.hasVoted" name="i-lucide-check-circle" class="h-4 w-4 text-emerald-500" />
      <span class="h-2.5 w-2.5 rounded-full" :class="participant.connected ? 'bg-emerald-500' : 'bg-gray-400'" />
      <UDropdown v-if="canModerateParticipant" :items="[[{ label: participant.role === 'OBSERVER' ? 'Hacer votante' : 'Hacer observador', icon: 'i-lucide-user-cog', click: () => $emit('changeRole', participant.id, participant.role === 'OBSERVER' ? 'VOTER' : 'OBSERVER') }, { label: 'Expulsar', icon: 'i-lucide-user-x', click: () => $emit('remove', participant.id) }]]">
        <UButton icon="i-lucide-more-vertical" color="gray" variant="ghost" size="xs" aria-label="Gestionar participante" />
      </UDropdown>
    </div>
  </li>
</template>
