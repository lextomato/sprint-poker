<script setup lang="ts">
import type { RoomStateView } from "@planning/shared";

const props = defineProps<{ state: RoomStateView }>();
const toast = useToast();

async function copyInvite() {
  const url = `${window.location.origin}/join/${props.state.room.code}`;
  await navigator.clipboard.writeText(url);
  toast.add({ color: "green", title: "Enlace copiado" });
}
</script>

<template>
  <header class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
    <div class="flex items-center gap-3">
      <AppLogo compact />
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-semibold">{{ state.room.name }}</h1>
          <RoomStatusBadge :status="state.room.status" />
        </div>
        <p class="text-sm text-gray-500">Codigo {{ state.room.code }}</p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <UButton to="/" icon="i-lucide-home" color="gray" variant="soft">Inicio</UButton>
      <ConnectionStatus />
      <ThemeToggle />
      <UButton icon="i-lucide-copy" color="gray" variant="soft" @click="copyInvite">Invitar</UButton>
    </div>
  </header>
</template>
