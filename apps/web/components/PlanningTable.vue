<script setup lang="ts">
import type { AvatarReactionView, ParticipantView, RevealedVoteView, RoomStatus } from "@planning/shared";

const props = defineProps<{ participants: ParticipantView[]; moderatorId: string | null; votes: RevealedVoteView[]; reactions: AvatarReactionView[]; status: RoomStatus }>();

const now = ref(Date.now());
let reactionTimer: ReturnType<typeof setInterval> | null = null;
const voters = computed(() => props.participants.filter((participant) => participant.role !== "OBSERVER"));
const observers = computed(() => props.participants.filter((participant) => participant.role === "OBSERVER"));
const revealed = computed(() => props.status === "REVEALED" || props.status === "CLOSED");
const voteByParticipantId = computed(() => new Map(props.votes.map((vote) => [vote.participantId, vote.value])));
const latestReactionByParticipantId = computed(() => {
  const visibleReactions = props.reactions.filter((reaction) => now.value - new Date(reaction.createdAt).getTime() <= 5000);
  return new Map(visibleReactions.map((reaction) => [reaction.participantId, reaction]));
});

onMounted(() => {
  reactionTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (reactionTimer) {
    clearInterval(reactionTimer);
  }
});

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function seatStyle(index: number, total: number) {
  const angle = -90 + (360 / Math.max(total, 1)) * index;
  const radiusX = 43;
  const radiusY = 34;
  const x = 50 + radiusX * Math.cos((angle * Math.PI) / 180);
  const y = 50 + radiusY * Math.sin((angle * Math.PI) / 180);
  return { left: `${x}%`, top: `${y}%` };
}

function voteValue(participantId: string) {
  return voteByParticipantId.value.get(participantId) ?? null;
}

function latestReaction(participantId: string) {
  return latestReactionByParticipantId.value.get(participantId) ?? null;
}
</script>

<template>
  <section class="rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Mesa</h2>
        <UBadge color="gray" variant="subtle">{{ voters.filter((participant) => participant.hasVoted).length }} / {{ voters.length }}</UBadge>
      </div>
      <UBadge color="gray" variant="subtle">{{ voters.length }} votantes</UBadge>
    </div>
    <div class="relative mx-auto aspect-[18/6] max-h-[210px] min-h-[150px] w-full">
      <div class="absolute left-1/2 top-1/2 flex h-[48%] w-[58%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[44%] border border-teal-200 bg-teal-50 text-center shadow-inner dark:border-teal-900 dark:bg-teal-950/40">
        <div>
          <div class="text-xs uppercase tracking-wide text-gray-500">Planning Poker</div>
        </div>
      </div>

      <div v-for="(participant, index) in voters" :key="participant.id" class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" :style="seatStyle(index, voters.length)">
        <div class="relative flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white text-xs font-bold shadow-sm dark:bg-gray-800" :class="participant.hasVoted ? 'border-emerald-500 text-emerald-700 dark:text-emerald-200' : 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-100'">
          {{ initials(participant.displayName) }}
          <UIcon v-if="participant.id === moderatorId" name="i-lucide-shield" class="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-amber-500 dark:bg-gray-900" />
          <span v-if="latestReaction(participant.id)" :key="latestReaction(participant.id)?.id" class="avatar-reaction">{{ latestReaction(participant.id)?.emoji }}</span>
        </div>
        <div v-if="participant.hasVoted || voteValue(participant.id)" class="poker-card" :class="{ 'is-revealed': revealed && voteValue(participant.id), 'is-new-vote': participant.hasVoted && !revealed }">
          <div class="poker-card-inner">
            <div class="poker-card-face poker-card-back">
              <span>PP</span>
            </div>
            <div class="poker-card-face poker-card-front">
              {{ voteValue(participant.id) ?? "?" }}
            </div>
          </div>
        </div>
        <div class="max-w-24 truncate rounded bg-white/90 px-2 py-0.5 text-xs text-gray-700 shadow-sm dark:bg-gray-800/90 dark:text-gray-200">
          {{ participant.displayName }}
        </div>
        <span class="h-2 w-2 rounded-full" :class="participant.connected ? 'bg-emerald-500' : 'bg-gray-400'" />
      </div>
    </div>
    <div v-if="observers.length" class="mt-3 flex flex-wrap gap-2">
      <UBadge v-for="observer in observers" :key="observer.id" color="gray" variant="subtle">
        {{ initials(observer.displayName) }} · {{ observer.displayName }}
      </UBadge>
    </div>
  </section>
</template>
