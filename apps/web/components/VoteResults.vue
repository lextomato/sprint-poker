<script setup lang="ts">
import type { RevealedVoteView, VoteStatistics } from "@planning/shared";

defineProps<{ votes: RevealedVoteView[]; statistics: VoteStatistics | null; canFinalize?: boolean; deck?: string[]; saveDisabled?: boolean }>();
defineEmits<{ finalize: [] }>();
const finalEstimate = defineModel<string | undefined>("finalEstimate", { default: undefined });
</script>

<template>
  <section v-if="statistics" class="vote-card-reveal space-y-3 rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
      <UCard :ui="{ body: { padding: 'p-3 sm:p-3' } }"><div class="text-xs text-gray-500">Media</div><div class="text-lg font-semibold">{{ statistics.average ?? "-" }}</div></UCard>
      <UCard :ui="{ body: { padding: 'p-3 sm:p-3' } }"><div class="text-xs text-gray-500">Mediana</div><div class="text-lg font-semibold">{{ statistics.median ?? "-" }}</div></UCard>
      <UCard :ui="{ body: { padding: 'p-3 sm:p-3' } }"><div class="text-xs text-gray-500">Moda</div><div class="text-lg font-semibold">{{ statistics.mode ?? "-" }}</div></UCard>
      <UCard :ui="{ body: { padding: 'p-3 sm:p-3' } }"><div class="text-xs text-gray-500">Min/Max</div><div class="text-lg font-semibold">{{ statistics.min ?? "-" }} / {{ statistics.max ?? "-" }}</div></UCard>
      <ConsensusIndicator :consensus="statistics.consensus" />
      <UCard v-if="canFinalize" class="border-teal-300 bg-teal-50/80 dark:border-teal-800 dark:bg-teal-950/30" :ui="{ body: { padding: 'p-3 sm:p-3' } }">
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-200">
            <UIcon name="i-lucide-save" class="h-4 w-4" />
            Estimacion final
          </div>
          <div class="flex gap-2">
            <FinalEstimateSelector v-model="finalEstimate" class="min-w-0 flex-1" :deck="deck ?? []" />
            <UButton icon="i-lucide-check" color="teal" :disabled="saveDisabled" square aria-label="Guardar estimacion final" @click="$emit('finalize')" />
          </div>
        </div>
      </UCard>
    </div>
    <div class="grid gap-3 lg:grid-cols-2">
      <div>
        <h2 class="mb-2 text-sm font-medium">Cartas</h2>
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
