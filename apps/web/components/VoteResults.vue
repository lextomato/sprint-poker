<script setup lang="ts">
import type { RevealedVoteView, VoteStatistics } from "@planning/shared";

defineProps<{ votes: RevealedVoteView[]; statistics: VoteStatistics | null }>();
</script>

<template>
  <section v-if="statistics" class="vote-card-reveal space-y-4 rounded-lg border border-gray-200 bg-white/90 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
    <div class="grid gap-3 sm:grid-cols-5">
      <UCard><div class="text-xs text-gray-500">Media</div><div class="text-xl font-semibold">{{ statistics.average ?? "-" }}</div></UCard>
      <UCard><div class="text-xs text-gray-500">Mediana</div><div class="text-xl font-semibold">{{ statistics.median ?? "-" }}</div></UCard>
      <UCard><div class="text-xs text-gray-500">Moda</div><div class="text-xl font-semibold">{{ statistics.mode ?? "-" }}</div></UCard>
      <UCard><div class="text-xs text-gray-500">Min/Max</div><div class="text-xl font-semibold">{{ statistics.min ?? "-" }} / {{ statistics.max ?? "-" }}</div></UCard>
      <ConsensusIndicator :consensus="statistics.consensus" />
    </div>
    <div class="grid gap-4 lg:grid-cols-2">
      <div>
        <h2 class="mb-2 font-medium">Cartas</h2>
        <div class="flex flex-wrap gap-2">
          <UBadge v-for="vote in votes" :key="vote.participantId" color="gray" variant="subtle">{{ vote.value }}</UBadge>
        </div>
      </div>
      <VoteDistribution :distribution="statistics.distribution" />
    </div>
    <div v-if="statistics.hasQuestion || statistics.hasBreak || statistics.highSpread || statistics.lowConsensus" class="space-y-2">
      <UAlert v-if="statistics.hasQuestion" color="amber" icon="i-lucide-help-circle" title="Hay votos con informacion insuficiente." />
      <UAlert v-if="statistics.hasBreak" color="amber" icon="i-lucide-coffee" title="Alguien solicito una pausa." />
      <UAlert v-if="statistics.highSpread" color="orange" icon="i-lucide-chart-no-axes-combined" title="La diferencia entre minimo y maximo es elevada." />
      <UAlert v-if="statistics.lowConsensus" color="red" icon="i-lucide-triangle-alert" title="El consenso esta por debajo del 60%." />
    </div>
  </section>
</template>
