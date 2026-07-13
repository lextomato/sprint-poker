<script setup lang="ts">
import type { ParticipantView } from "@planning/shared";

const props = defineProps<{ participants: ParticipantView[] }>();
const voters = computed(() => props.participants.filter((participant) => participant.role !== "OBSERVER"));
const voted = computed(() => voters.value.filter((participant) => participant.hasVoted).length);
</script>

<template>
  <div class="rounded-md bg-gray-50 p-3 dark:bg-gray-800">
    <div class="mb-2 flex items-center justify-between text-sm">
      <span>Votos</span>
      <span>{{ voted }} / {{ voters.length }}</span>
    </div>
    <UProgress :value="voters.length ? (voted / voters.length) * 100 : 0" color="teal" />
  </div>
</template>
