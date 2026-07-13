<script setup lang="ts">
defineProps<{ compact?: boolean }>();
</script>

<template>
  <div class="flex items-center gap-3">
    <img src="/brand/sprint-poker-mark.svg" alt="" class="h-10 w-10 shrink-0 rounded-lg shadow-sm" />
    <div v-if="!compact" class="leading-tight">
      <div class="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">Sprint Poker</div>
      <div class="text-xs text-gray-500 dark:text-gray-400">Planning con cartas</div>
    </div>
  </div>
</template>
