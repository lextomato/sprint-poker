<script setup lang="ts">
import { ParticipantRole, RoomType, type RoomStateView } from "@planning/shared";

const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();
const { showApiError } = useApiErrors();
const recentRooms = useRecentRooms();
const roomCode = computed(() => String(route.params.roomCode).toUpperCase());
const session = computed(() => useParticipantSession(roomCode.value));
const form = reactive({ participantName: "", role: ParticipantRole.VOTER });
const roles = [
  { label: "Votante", value: ParticipantRole.VOTER },
  { label: "Observador", value: ParticipantRole.OBSERVER }
];
const loading = ref(false);

function destination(type: RoomType | undefined, code: string) {
  if (type === RoomType.TEAM) return `/teams/${code}`;
  if (type === RoomType.RETROSPECTIVE) return `/retrospectives/${code}`;
  return `/rooms/${code}`;
}

const { data: room, pending } = await useFetch<{ code: string; name: string; type: RoomType; status: string }>(() => `/rooms/${roomCode.value}`, {
  baseURL: config.public.apiBaseUrl
});

onMounted(async () => {
  const token = session.value.getToken();
  if (!token) return;
  try {
    await $fetch(`/rooms/${roomCode.value}/reconnect`, {
      baseURL: config.public.apiBaseUrl,
      method: "POST",
      body: { sessionToken: token }
    });
    await router.push(destination(room.value?.type, roomCode.value));
  } catch {
    session.value.clearToken();
  }
});

async function joinRoom() {
  loading.value = true;
  try {
    const response = await $fetch<{ sessionToken: string; roomCode: string; state: RoomStateView }>(`/rooms/${roomCode.value}/join`, {
      baseURL: config.public.apiBaseUrl,
      method: "POST",
      body: form,
      headers: useAuth().headers()
    });
    session.value.setToken(response.sessionToken);
    recentRooms.rememberState(response.state);
    await router.push(destination(response.state.room.type, response.roomCode));
  } catch (error) {
    showApiError(error, "No se pudo entrar a la sala");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="page-shell flex min-h-screen items-center justify-center px-4 py-8">
    <div class="fixed right-4 top-4">
      <ThemeToggle />
    </div>
    <UCard class="w-full max-w-md">
      <template #header>
        <div>
          <USkeleton v-if="pending" class="h-6 w-40" />
          <div v-else class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-lg" :class="room?.type === RoomType.TEAM ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300' : room?.type === RoomType.RETROSPECTIVE ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300'">
              <UIcon :name="room?.type === RoomType.TEAM ? 'i-lucide-layout-dashboard' : room?.type === RoomType.RETROSPECTIVE ? 'i-lucide-panels-top-left' : 'i-lucide-spade'" class="h-5 w-5" />
            </div>
            <h1 class="text-xl font-semibold">{{ room?.name ?? "Sala no encontrada" }}</h1>
          </div>
          <p class="text-sm text-gray-500">{{ roomCode }}</p>
        </div>
      </template>
      <UForm :state="form" class="space-y-4" @submit="joinRoom">
        <UFormGroup label="Nombre visible" name="participantName" required>
          <UInput v-model="form.participantName" minlength="2" maxlength="40" />
        </UFormGroup>
        <UFormGroup label="Rol" name="role">
          <USelectMenu v-model="form.role" :options="roles" value-attribute="value" option-attribute="label" />
        </UFormGroup>
        <UButton type="submit" block color="teal" icon="i-lucide-log-in" :loading="loading">Entrar</UButton>
      </UForm>
    </UCard>
  </main>
</template>
