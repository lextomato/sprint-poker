<script setup lang="ts">
defineProps<{ consensus: number | null }>();
</script>

<template>
  <div class="rounded-md p-3 shadow-sm ring-1 ring-inset ring-gray-200 dark:ring-gray-800" :class="consensus !== null && consensus >= 60 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30'">
    <div class="text-xs uppercase tracking-wide">Consenso</div>
    <div class="text-lg font-semibold">{{ consensus ?? 0 }}%</div>
  </div>
</template>
