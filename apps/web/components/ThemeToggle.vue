<script setup lang="ts">
const { themeMode, initTheme, toggleTheme } = useThemeMode();

onMounted(initTheme);
</script>

<template>
  <UButton :icon="themeMode === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'" color="gray" variant="soft" aria-label="Cambiar tema" @click="toggleTheme" />
</template>
