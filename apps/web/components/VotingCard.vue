<script setup lang="ts">
defineProps<{ value: string; selected: boolean; disabled?: boolean }>();
defineEmits<{ select: [string] }>();
</script>

<template>
  <button class="h-20 rounded-lg border text-xl font-semibold shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50" :class="selected ? 'border-teal-500 bg-teal-500 text-white' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'" :disabled="disabled" @click="$emit('select', value)">
    {{ value }}
  </button>
</template>
