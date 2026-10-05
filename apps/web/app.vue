<script setup lang="ts">
const { initTheme } = useThemeMode();

onMounted(initTheme);
</script>

<template>
  <NuxtLayout>
    <CrashControl />
    <div class="crash-stage">
      <NuxtPage />
      <UNotifications />
    </div>
    <CoffeeDonationButton />
  </NuxtLayout>
</template>
