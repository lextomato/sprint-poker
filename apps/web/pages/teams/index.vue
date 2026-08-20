<script setup lang="ts">
import { DailyMode, type RoomStateView } from "@planning/shared";

const config = useRuntimeConfig();
const router = useRouter();
const auth = useAuth();
const recentRooms = useRecentRooms();
const { showApiError } = useApiErrors();
const form = reactive({ roomName: "", participantName: "", dailyMode: DailyMode.HYBRID, turnDurationSeconds: 120 });
const joinCode = ref("");
const loading = ref(false);
type TeamSummary = { code: string; name: string; status: string; lastActivityAt: string };
const teams = ref<TeamSummary[]>([]);
const modes = [
  { label: "Híbrida", value: DailyMode.HYBRID },
  { label: "Síncrona", value: DailyMode.SYNCHRONOUS },
  { label: "Asíncrona", value: DailyMode.ASYNCHRONOUS }
];

onMounted(async () => {
  await auth.load();
  if (auth.user.value) {
    form.participantName = auth.user.value.displayName;
    teams.value = await $fetch<TeamSummary[]>("/teams/mine", { baseURL: config.public.apiBaseUrl, headers: auth.headers() }).catch((): TeamSummary[] => []);
  }
});

async function createTeam() {
  loading.value = true;
  try {
    const response = await $fetch<{ roomCode: string; sessionToken: string; state: RoomStateView }>("/teams", {
      baseURL: config.public.apiBaseUrl,
      method: "POST",
      headers: auth.headers(),
      body: form
    });
    useParticipantSession(response.roomCode).setToken(response.sessionToken);
    recentRooms.rememberState(response.state);
    await router.push(`/teams/${response.roomCode}`);
  } catch (error) {
    showApiError(error, "No se pudo crear el equipo");
  } finally {
    loading.value = false;
  }
}

async function accessTeam(code: string) {
  try {
    const response = await $fetch<{ roomCode: string; sessionToken: string; state: RoomStateView }>(`/teams/${code}/access`, {
      baseURL: config.public.apiBaseUrl,
      method: "POST",
      headers: auth.headers()
    });
    useParticipantSession(response.roomCode).setToken(response.sessionToken);
    recentRooms.rememberState(response.state);
    await router.push(`/teams/${response.roomCode}`);
  } catch (error) {
    showApiError(error, "No se pudo recuperar el equipo");
  }
}

function goJoin() {
  const code = joinCode.value.trim().toUpperCase();
  if (code) router.push(`/join/${code}`);
}
</script>

<template>
  <main class="page-shell min-h-screen px-4 py-8 sm:px-6">
    <div class="mx-auto w-full max-w-6xl">
      <header class="flex items-center justify-between"><UButton to="/" icon="i-lucide-arrow-left" color="gray" variant="ghost">Inicio</UButton><div class="flex items-center gap-1"><AccountMenu /><ThemeToggle /></div></header>
      <section class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <div class="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300"><UIcon name="i-lucide-layout-dashboard" class="h-7 w-7" /></div>
          <h1 class="text-4xl font-bold text-gray-950 dark:text-white">Virtual Team Room</h1>
          <p class="mt-3 max-w-2xl text-lg text-gray-600 dark:text-gray-300">Un espacio persistente para ver al equipo, entrar a ceremonias y mantener el hilo entre dailys.</p>
          <div class="mt-6 flex max-w-md gap-2"><UInput v-model="joinCode" class="flex-1" placeholder="Código de equipo" @keyup.enter="goJoin" /><UButton icon="i-lucide-log-in" color="gray" variant="soft" @click="goJoin">Entrar</UButton></div>

          <section v-if="teams.length" class="mt-8">
            <h2 class="mb-3 text-sm font-semibold uppercase text-gray-500">Tus equipos</h2>
            <div class="grid gap-2 sm:grid-cols-2">
              <button v-for="team in teams" :key="team.code" class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-cyan-400 dark:border-gray-800 dark:bg-gray-900" @click="accessTeam(team.code)">
                <div><p class="font-medium">{{ team.name }}</p><p class="text-xs text-gray-500">{{ team.code }}</p></div><UIcon name="i-lucide-arrow-right" class="h-4 w-4 text-cyan-600" />
              </button>
            </div>
          </section>
        </div>

        <UCard>
          <template #header><div><h2 class="font-semibold">Crear equipo</h2><p class="text-xs text-gray-500">{{ auth.user.value ? 'Quedará asociado a tu cuenta.' : 'También puedes continuar como invitado.' }}</p></div></template>
          <UForm :state="form" class="space-y-4" @submit="createTeam">
            <UFormGroup label="Nombre del equipo" required><UInput v-model="form.roomName" minlength="3" maxlength="80" placeholder="Equipo Core" /></UFormGroup>
            <UFormGroup label="Tu nombre" required><UInput v-model="form.participantName" minlength="2" maxlength="40" /></UFormGroup>
            <UFormGroup label="Formato de daily"><USelectMenu v-model="form.dailyMode" :options="modes" value-attribute="value" option-attribute="label" /></UFormGroup>
            <UFormGroup label="Tiempo por persona"><UInput v-model.number="form.turnDurationSeconds" type="number" min="30" max="900" step="30" /></UFormGroup>
            <UButton type="submit" block color="cyan" icon="i-lucide-plus-circle" :loading="loading">Crear Team Room</UButton>
          </UForm>
        </UCard>
      </section>
    </div>
  </main>
</template>
