<script setup lang="ts">
import type { RoomStateView } from "@planning/shared";
import type { RecentRoom } from "~/composables/useRecentRooms";

const config = useRuntimeConfig();
const router = useRouter();
const { showApiError } = useApiErrors();
const recentRooms = useRecentRooms();
const createForm = reactive({ roomName: "", participantName: "", firstStoryTitle: "" });
const joinCode = ref("");
const loading = ref(false);
const rooms = computed(() => recentRooms.rooms.value);

onMounted(() => {
  recentRooms.load();
});

interface CreateRoomResponse {
  roomCode: string;
  sessionToken: string;
  state: RoomStateView;
}

async function createRoom() {
  loading.value = true;
  try {
    const response = await $fetch<CreateRoomResponse>("/rooms", {
      baseURL: config.public.apiBaseUrl,
      method: "POST",
      body: {
        roomName: createForm.roomName,
        participantName: createForm.participantName,
        ...(createForm.firstStoryTitle.trim() ? { firstStoryTitle: createForm.firstStoryTitle } : {})
      }
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
  if (code) {
    router.push(`/join/${code}`);
  }
}

function openRecentRoom(room: RecentRoom) {
  if (recentRooms.hasSession(room.code)) {
    router.push(`/rooms/${room.code}`);
    return;
  }
  router.push(`/join/${room.code}`);
}
</script>

<template>
  <main class="page-shell min-h-screen px-4 py-8">
    <div class="fixed right-4 top-4">
      <ThemeToggle />
    </div>
    <section class="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1fr_420px]">
      <div class="flex flex-col justify-center">
        <div class="mb-5">
          <AppLogo />
        </div>
        <h1 class="max-w-xl text-5xl font-bold text-gray-950 dark:text-white">Sprint Poker</h1>
        <p class="mt-4 max-w-xl text-lg text-gray-600 dark:text-gray-300">Estimaciones agiles en tiempo real con votos privados, revelado simultaneo e historial de sesion.</p>
        <div class="mt-6 flex max-w-md gap-2">
          <UInput v-model="joinCode" class="flex-1" placeholder="Codigo de sala" @keyup.enter="goJoin" />
          <UButton icon="i-lucide-log-in" color="gray" variant="soft" @click="goJoin">Entrar</UButton>
        </div>

        <section v-if="rooms.length" class="mt-8">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Salas recientes</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <div v-for="room in rooms" :key="room.code" class="rounded-lg border border-gray-200 bg-white/90 p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate font-medium text-gray-950 dark:text-white">{{ room.name }}</p>
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{{ room.code }}</span>
                    <RoomStatusBadge :status="room.status" />
                    <span v-if="room.participantName">como {{ room.participantName }}</span>
                  </div>
                </div>
                <UButton :icon="recentRooms.hasSession(room.code) ? 'i-lucide-rotate-ccw' : 'i-lucide-log-in'" color="teal" variant="soft" size="xs" @click="openRecentRoom(room)">
                  {{ recentRooms.hasSession(room.code) ? "Recuperar" : "Entrar" }}
                </UButton>
              </div>
            </div>
          </div>
        </section>
      </div>

      <UCard>
        <template #header>
          <h2 class="font-semibold">Crear sala</h2>
        </template>
        <UForm :state="createForm" class="space-y-4" @submit="createRoom">
          <UFormGroup label="Nombre de la sala" name="roomName" required>
            <UInput v-model="createForm.roomName" minlength="3" maxlength="80" />
          </UFormGroup>
          <UFormGroup label="Tu nombre" name="participantName" required>
            <UInput v-model="createForm.participantName" minlength="2" maxlength="40" />
          </UFormGroup>
          <UFormGroup label="Primera HDU opcional" name="firstStoryTitle">
            <UInput v-model="createForm.firstStoryTitle" maxlength="200" />
          </UFormGroup>
          <UButton type="submit" block color="teal" icon="i-lucide-plus-circle" :loading="loading">Crear sala</UButton>
        </UForm>
      </UCard>
    </section>
  </main>
</template>
