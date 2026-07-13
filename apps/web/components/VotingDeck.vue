<script setup lang="ts">
defineProps<{ deck: string[]; selected: string | null; disabled?: boolean }>();
defineEmits<{ select: [string] }>();
</script>

<template>
  <div class="grid grid-cols-4 gap-2 sm:grid-cols-7">
    <VotingCard v-for="card in deck" :key="card" :value="card" :selected="selected === card" :disabled="disabled" @select="$emit('select', $event)" />
  </div>
</template>
