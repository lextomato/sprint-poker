<script setup lang="ts">
defineProps<{ canManage: boolean; isVoting: boolean; isRevealed: boolean; hasActiveStory: boolean }>();
defineEmits<{ reveal: []; restart: [] }>();
</script>

<template>
  <div v-if="canManage && hasActiveStory" class="flex flex-wrap gap-2">
    <UButton v-if="isVoting" icon="i-lucide-eye" color="teal" @click="$emit('reveal')">Revelar</UButton>
    <UButton v-if="isRevealed" icon="i-lucide-refresh-cw" color="gray" variant="soft" @click="$emit('restart')">Nueva ronda</UButton>
  </div>
</template>
