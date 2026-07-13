<script setup lang="ts">
defineProps<{ deck: string[]; disabled?: boolean }>();
const model = defineModel<string | undefined>({ default: undefined });
</script>

<template>
  <USelectMenu v-model="model" :options="deck" :disabled="disabled" placeholder="Estimacion final" />
</template>
