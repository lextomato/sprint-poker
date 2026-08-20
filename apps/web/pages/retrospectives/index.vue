<script setup lang="ts">
import type { RoomStateView } from "@planning/shared";

const config = useRuntimeConfig();
const router = useRouter();
const { showApiError } = useApiErrors();
const recentRooms = useRecentRooms();
const createForm = reactive({ roomName: "", participantName: "" });
const joinCode = ref("");
const loading = ref(false);

async function createRoom() {
  loading.value = true;
  try {
    const response = await $fetch<{ roomCode: string; sessionToken: string; state: RoomStateView }>("/retrospectives", { baseURL: config.public.apiBaseUrl, method: "POST", body: createForm });
    useParticipantSession(response.roomCode).setToken(response.sessionToken);
    recentRooms.rememberState(response.state);
    await router.push(`/retrospectives/${response.roomCode}`);
  } catch (error) {
    showApiError(error, "No se pudo crear la retrospectiva");
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
          <div class="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><UIcon name="i-lucide-panels-top-left" class="h-7 w-7" /></div>
          <h1 class="text-4xl font-bold text-gray-950 dark:text-white">Retrospectiva</h1>
          <p class="mt-3 max-w-xl text-lg text-gray-600 dark:text-gray-300">Haz visible lo aprendido, prioriza los temas importantes y sal con acciones concretas.</p>
          <div class="mt-6 flex max-w-md gap-2"><UInput v-model="joinCode" class="flex-1" placeholder="Código de sala" @keyup.enter="goJoin" /><UButton icon="i-lucide-log-in" color="gray" variant="soft" @click="goJoin">Entrar</UButton></div>
        </div>
        <UCard>
          <template #header><h2 class="font-semibold">Crear retrospectiva</h2></template>
          <UForm :state="createForm" class="space-y-4" @submit="createRoom">
            <UFormGroup label="Nombre de la retrospectiva" name="roomName" required><UInput v-model="createForm.roomName" minlength="3" maxlength="80" placeholder="Retro Sprint 24" /></UFormGroup>
            <UFormGroup label="Tu nombre" name="participantName" required><UInput v-model="createForm.participantName" minlength="2" maxlength="40" /></UFormGroup>
            <div class="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Se crearán tres columnas: salió bien, podemos mejorar e ideas.</div>
            <UButton type="submit" block color="amber" icon="i-lucide-plus-circle" :loading="loading">Crear retrospectiva</UButton>
          </UForm>
        </UCard>
      </section>
    </div>
  </main>
</template>
