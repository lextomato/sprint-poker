<script setup lang="ts">
defineProps<{ distribution: Record<string, number> }>();
</script>

<template>
  <div class="space-y-2">
    <div v-for="[value, count] in Object.entries(distribution)" :key="value" class="flex items-center gap-3">
      <div class="w-14 font-medium">{{ value }}</div>
      <UProgress :value="count" :max="Math.max(...Object.values(distribution))" color="teal" class="flex-1" />
      <div class="w-8 text-right text-sm text-gray-500">{{ count }}</div>
    </div>
  </div>
</template>
