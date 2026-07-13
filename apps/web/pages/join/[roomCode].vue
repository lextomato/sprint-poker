<script setup lang="ts">
import { ParticipantRole, type RoomStateView } from "@planning/shared";

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

const { data: room, pending } = await useFetch<{ code: string; name: string; status: string }>(() => `/rooms/${roomCode.value}`, {
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
    await router.push(`/rooms/${roomCode.value}`);
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
      body: form
    });
    session.value.setToken(response.sessionToken);
    recentRooms.rememberState(response.state);
    await router.push(`/rooms/${response.roomCode}`);
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
          <h1 v-else class="text-xl font-semibold">{{ room?.name ?? "Sala no encontrada" }}</h1>
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
