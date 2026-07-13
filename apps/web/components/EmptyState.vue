<script setup lang="ts">
defineProps<{ icon: string; title: string }>();
</script>

<template>
  <div class="flex min-h-28 flex-col items-center justify-center rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-500 dark:border-gray-700">
    <UIcon :name="icon" class="mb-2 h-6 w-6" />
    <p class="font-medium">{{ title }}</p>
  </div>
</template>
