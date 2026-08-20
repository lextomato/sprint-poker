<script setup lang="ts">
import type { RoomStateView } from "@planning/shared";

const config = useRuntimeConfig();
const router = useRouter();
const { showApiError } = useApiErrors();
const recentRooms = useRecentRooms();
const createForm = reactive({ roomName: "", participantName: "", firstStoryTitle: "" });
const joinCode = ref("");
const loading = ref(false);

async function createRoom() {
  loading.value = true;
  try {
    const response = await $fetch<{ roomCode: string; sessionToken: string; state: RoomStateView }>("/rooms", {
      baseURL: config.public.apiBaseUrl,
      method: "POST",
      body: { roomName: createForm.roomName, participantName: createForm.participantName, ...(createForm.firstStoryTitle.trim() ? { firstStoryTitle: createForm.firstStoryTitle } : {}) }
    });
    useParticipantSession(response.roomCode).setToken(response.sessionToken);
    recentRooms.rememberState(response.state);
    await router.push(`/rooms/${response.roomCode}`);
  } catch (error) {
    showApiError(error, "No se pudo crear la sala");
  } finally {
    loading.value = false;
  }
}

function goJoin() {
  const code = joinCode.value.trim().toUpperCase();
  if (code) router.push(`/join/${code}`);
}
</script>

<template>
  <main class="page-shell min-h-screen px-4 py-8">
    <div class="mx-auto w-full max-w-5xl">
      <header class="flex items-center justify-between"><UButton to="/" icon="i-lucide-arrow-left" color="gray" variant="ghost">Inicio</UButton><ThemeToggle /></header>
      <section class="mt-8 grid gap-8 lg:grid-cols-[1fr_420px]">
        <div class="flex flex-col justify-center">
          <div class="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><UIcon name="i-lucide-spade" class="h-7 w-7" /></div>
          <h1 class="text-4xl font-bold text-gray-950 dark:text-white">Planning Poker</h1>
          <p class="mt-3 max-w-xl text-lg text-gray-600 dark:text-gray-300">Crea la sala, invita al equipo y estima historias con votos privados.</p>
          <div class="mt-6 flex max-w-md gap-2"><UInput v-model="joinCode" class="flex-1" placeholder="Código de sala" @keyup.enter="goJoin" /><UButton icon="i-lucide-log-in" color="gray" variant="soft" @click="goJoin">Entrar</UButton></div>
        </div>
        <UCard>
          <template #header><h2 class="font-semibold">Crear planning</h2></template>
          <UForm :state="createForm" class="space-y-4" @submit="createRoom">
            <UFormGroup label="Nombre de la sala" name="roomName" required><UInput v-model="createForm.roomName" minlength="3" maxlength="80" /></UFormGroup>
            <UFormGroup label="Tu nombre" name="participantName" required><UInput v-model="createForm.participantName" minlength="2" maxlength="40" /></UFormGroup>
            <UFormGroup label="Primera HDU opcional" name="firstStoryTitle"><UInput v-model="createForm.firstStoryTitle" maxlength="200" /></UFormGroup>
            <UButton type="submit" block color="teal" icon="i-lucide-plus-circle" :loading="loading">Crear sala</UButton>
          </UForm>
        </UCard>
      </section>
    </div>
  </main>
</template>
