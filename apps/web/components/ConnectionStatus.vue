<script setup lang="ts">
const connection = useConnectionStore();
</script>

<template>
  <div class="flex items-center gap-2 text-sm">
    <span class="h-2.5 w-2.5 rounded-full" :class="connection.connected ? 'bg-emerald-500' : 'bg-amber-500'" />
    <span class="text-gray-600 dark:text-gray-300">{{ connection.connected ? "Conectado" : "Reconectando" }}</span>
  </div>
</template>
