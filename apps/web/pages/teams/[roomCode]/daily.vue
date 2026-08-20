<script setup lang="ts">
import { DailyMode, DailyStatus, RoomType, TeamZone, type DailyEntryView, type DailySessionView } from "@planning/shared";

const route = useRoute();
const router = useRouter();
const roomCode = computed(() => String(route.params.roomCode).toUpperCase());
const roomStore = useRoomStore();
const participantStore = useParticipantStore();
const socket = useRoomSocket(roomCode.value);
const teamActions = useTeam(roomCode.value);
const state = computed(() => roomStore.state);
const sessions = computed(() => state.value?.team?.sessions ?? []);
const selectedDailyId = ref("");
const selectedDaily = computed(() => sessions.value.find((daily) => daily.id === selectedDailyId.value) ?? sessions.value[0] ?? null);
const myEntry = computed(() => selectedDaily.value?.entries.find((entry) => entry.participantId === state.value?.me?.id));
const currentParticipant = computed(() => state.value?.participants.find((participant) => participant.id === selectedDaily.value?.currentParticipantId));
const canManage = computed(() => participantStore.isModerator);
const form = reactive({ yesterday: "", today: "", blocker: "", mood: "" });
const actionForm = reactive({ content: "", assigneeName: "" });
const actionOpen = ref(false);
const createOpen = ref(false);
const createForm = reactive({ date: new Date().toISOString().slice(0, 10), mode: DailyMode.HYBRID, turnDurationSeconds: 120 });
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
const moods = ["🙂", "😄", "😐", "😓", "🤯"];
const modeOptions = [
  { label: "Híbrida", value: DailyMode.HYBRID },
  { label: "Síncrona", value: DailyMode.SYNCHRONOUS },
  { label: "Asíncrona", value: DailyMode.ASYNCHRONOUS }
];
const sessionOptions = computed(() => sessions.value.map((daily) => ({ label: formatDate(daily.date), value: daily.id })));
const openBlockers = computed(() => sessions.value.flatMap((daily) => daily.blockers).filter((blocker) => !blocker.resolvedAt));
const remainingSeconds = computed(() => {
  const daily = selectedDaily.value;
  if (!daily?.currentTurnStartedAt) return daily?.turnDurationSeconds ?? 0;
  return Math.max(0, daily.turnDurationSeconds - Math.floor((now.value - new Date(daily.currentTurnStartedAt).getTime()) / 1000));
});

onMounted(async () => {
  const ok = await socket.sync();
  if (!ok) return router.push(`/join/${roomCode.value}`);
  selectedDailyId.value = state.value?.daily?.id ?? "";
  if (state.value?.me) await teamActions.updatePresence(state.value.me.availability, TeamZone.DAILY_ROOM, state.value.me.activity);
  timer = setInterval(() => { now.value = Date.now(); }, 1000);
});

onBeforeUnmount(() => { if (timer) clearInterval(timer); });

watch(() => state.value?.room.type, (type) => {
  if (type && type !== RoomType.TEAM) void router.replace("/");
});

watch(myEntry, (entry) => {
  form.yesterday = entry?.yesterday ?? "";
  form.today = entry?.today ?? "";
  form.mood = entry?.mood ?? "";
}, { immediate: true });

watch(sessions, (value) => {
  if (!selectedDailyId.value && value[0]) selectedDailyId.value = value[0].id;
});

async function saveEntry() {
  if (!selectedDaily.value) return;
  const ok = await teamActions.saveEntry(selectedDaily.value.id, form.yesterday, form.today, form.mood || null, form.blocker || null);
  if (ok) form.blocker = "";
}

async function createAction() {
  if (!selectedDaily.value || !actionForm.content.trim()) return;
  if (await teamActions.createAction(selectedDaily.value.id, actionForm.content, actionForm.assigneeName || null)) {
    actionForm.content = "";
    actionForm.assigneeName = "";
    actionOpen.value = false;
  }
}

function openActionFromEntry(entry: DailyEntryView) {
  actionForm.content = `Dar seguimiento: ${entry.today || entry.yesterday}`;
  actionForm.assigneeName = entry.participantName;
  actionOpen.value = true;
}

async function createDaily() {
  if (await teamActions.createDaily(createForm.date, createForm.mode, createForm.turnDurationSeconds)) createOpen.value = false;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function formatTimer(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function entryFor(participantId: string, daily: DailySessionView | null = selectedDaily.value) {
  return daily?.entries.find((entry) => entry.participantId === participantId);
}
</script>

<template>
  <main class="min-h-screen bg-gray-100 p-3 dark:bg-gray-950 sm:p-4">
    <template v-if="state?.team">
      <header class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div class="flex items-center gap-3"><UButton :to="`/teams/${roomCode}`" icon="i-lucide-arrow-left" color="gray" variant="ghost" aria-label="Volver al Team Room" /><div><h1 class="font-semibold text-gray-950 dark:text-white">Daily · {{ state.room.name }}</h1><p class="text-xs text-gray-500">Actualizaciones, blockers y compromisos</p></div></div>
        <div class="flex items-center gap-2"><USelectMenu v-if="sessionOptions.length" v-model="selectedDailyId" class="w-44" :options="sessionOptions" value-attribute="value" option-attribute="label" /><UButton v-if="canManage" icon="i-lucide-calendar-plus" color="gray" variant="soft" @click="createOpen = true">Nueva</UButton><ThemeToggle /></div>
      </header>

      <template v-if="selectedDaily">
        <section class="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="border-l-4 border-cyan-500 bg-white p-3 dark:bg-gray-900"><p class="text-xs uppercase text-gray-500">Participación</p><p class="mt-1 text-2xl font-semibold">{{ selectedDaily.participationRate }}%</p></div>
          <div class="border-l-4 border-rose-500 bg-white p-3 dark:bg-gray-900"><p class="text-xs uppercase text-gray-500">Blockers abiertos</p><p class="mt-1 text-2xl font-semibold">{{ state.team.metrics.openBlockers }}</p></div>
          <div class="border-l-4 border-amber-500 bg-white p-3 dark:bg-gray-900"><p class="text-xs uppercase text-gray-500">Duración</p><p class="mt-1 text-2xl font-semibold">{{ selectedDaily.durationMinutes ?? 0 }} min</p></div>
          <div class="border-l-4 border-emerald-500 bg-white p-3 dark:bg-gray-900"><p class="text-xs uppercase text-gray-500">Formato</p><p class="mt-1 font-semibold">{{ modeOptions.find(item => item.value === selectedDaily?.mode)?.label }}</p><p class="text-xs text-gray-500">{{ formatDate(selectedDaily.date) }}</p></div>
        </section>

        <section v-if="selectedDaily.mode !== DailyMode.ASYNCHRONOUS" class="mb-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <div class="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-lg font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{{ currentParticipant?.displayName.slice(0, 2).toUpperCase() || '--' }}</div>
              <div><p class="text-xs uppercase text-gray-500">{{ selectedDaily.status === DailyStatus.ACTIVE ? 'Turno actual' : selectedDaily.status === DailyStatus.COMPLETED ? 'Daily finalizada' : 'Lista para comenzar' }}</p><h2 class="text-xl font-semibold">{{ currentParticipant?.displayName || 'Todo el equipo' }}</h2><p v-if="currentParticipant" class="text-sm text-gray-500">{{ entryFor(currentParticipant.id) ? 'Actualización publicada' : 'Aún no publicó su actualización' }}</p></div>
            </div>
            <div class="flex items-center gap-3"><span v-if="selectedDaily.status === DailyStatus.ACTIVE" class="font-mono text-3xl font-semibold" :class="remainingSeconds < 20 ? 'text-rose-600' : 'text-gray-900 dark:text-white'">{{ formatTimer(remainingSeconds) }}</span><UButton v-if="canManage && selectedDaily.status === DailyStatus.OPEN" icon="i-lucide-play" color="emerald" @click="teamActions.startDaily(selectedDaily.id)">Iniciar</UButton><UButton v-if="canManage && selectedDaily.status === DailyStatus.ACTIVE" icon="i-lucide-skip-forward" color="emerald" @click="teamActions.nextParticipant(selectedDaily.id)">Siguiente</UButton><UButton v-if="canManage && selectedDaily.status !== DailyStatus.COMPLETED" icon="i-lucide-square" color="red" variant="soft" @click="teamActions.completeDaily(selectedDaily.id)">Finalizar</UButton></div>
          </div>
          <div v-if="currentParticipant && entryFor(currentParticipant.id)" class="mt-4 grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-2 dark:border-gray-800"><div><p class="text-xs font-semibold uppercase text-gray-500">Ayer</p><p class="mt-1 whitespace-pre-wrap text-sm">{{ entryFor(currentParticipant.id)?.yesterday }}</p></div><div><p class="text-xs font-semibold uppercase text-gray-500">Hoy</p><p class="mt-1 whitespace-pre-wrap text-sm">{{ entryFor(currentParticipant.id)?.today }}</p></div></div>
        </section>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div class="space-y-4">
            <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div class="mb-4 flex items-center justify-between"><div><h2 class="font-semibold">Mi actualización</h2><p class="text-xs text-gray-500">Puedes editarla mientras la daily esté abierta.</p></div><div class="flex gap-1"><button v-for="mood in moods" :key="mood" class="rounded p-1.5 text-lg" :class="form.mood === mood ? 'bg-cyan-100 ring-1 ring-cyan-500 dark:bg-cyan-950' : 'hover:bg-gray-100 dark:hover:bg-gray-800'" @click="form.mood = mood">{{ mood }}</button></div></div>
              <div class="grid gap-3 md:grid-cols-2"><UFormGroup label="Qué hice ayer"><UTextarea v-model="form.yesterday" :rows="4" maxlength="2000" /></UFormGroup><UFormGroup label="Qué haré hoy"><UTextarea v-model="form.today" :rows="4" maxlength="2000" /></UFormGroup></div>
              <UFormGroup class="mt-3" label="Nuevo blocker"><UInput v-model="form.blocker" maxlength="500" icon="i-lucide-octagon-alert" placeholder="Opcional, se mantendrá abierto hasta resolverlo" /></UFormGroup>
              <div class="mt-3 flex justify-end"><UButton color="cyan" icon="i-lucide-send" :disabled="selectedDaily.status === DailyStatus.COMPLETED || (!form.yesterday.trim() && !form.today.trim() && !form.blocker.trim())" @click="saveEntry">Publicar actualización</UButton></div>
            </section>

            <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div class="mb-3 flex items-center justify-between"><h2 class="font-semibold">Vista del equipo</h2><span class="text-xs text-gray-500">{{ selectedDaily.entries.length }} / {{ state.participants.filter(p => p.role !== 'OBSERVER').length }} respondieron</span></div>
              <div class="divide-y divide-gray-100 dark:divide-gray-800">
                <article v-for="participant in state.participants.filter(p => p.role !== 'OBSERVER')" :key="participant.id" class="py-3">
                  <div class="flex items-center justify-between gap-3"><div class="flex items-center gap-2"><span class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold dark:bg-gray-800">{{ participant.displayName.slice(0, 2).toUpperCase() }}</span><div><p class="text-sm font-medium">{{ participant.displayName }} <span v-if="entryFor(participant.id)?.mood">{{ entryFor(participant.id)?.mood }}</span></p><p class="text-xs" :class="entryFor(participant.id) ? 'text-emerald-600' : 'text-amber-600'">{{ entryFor(participant.id) ? 'Actualizado' : 'Pendiente' }}</p></div></div><UIcon :name="entryFor(participant.id) ? 'i-lucide-circle-check' : 'i-lucide-clock-3'" :class="entryFor(participant.id) ? 'text-emerald-500' : 'text-amber-500'" /></div>
                  <div v-if="entryFor(participant.id)" class="mt-2 pl-10 text-sm"><div class="grid gap-2 md:grid-cols-2"><p><span class="font-medium text-gray-500">Ayer:</span> {{ entryFor(participant.id)?.yesterday || '—' }}</p><p><span class="font-medium text-gray-500">Hoy:</span> {{ entryFor(participant.id)?.today || '—' }}</p></div><UButton class="mt-2" icon="i-lucide-list-plus" size="xs" color="gray" variant="ghost" @click="openActionFromEntry(entryFor(participant.id)!)">Convertir en acción</UButton></div>
                </article>
              </div>
            </section>
          </div>

          <aside class="space-y-4">
            <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div class="mb-3 flex items-center justify-between"><div><h2 class="font-semibold">Blockers</h2><p class="text-xs text-gray-500">Incluye pendientes de días anteriores</p></div><UBadge color="red" variant="soft">{{ openBlockers.length }}</UBadge></div>
              <div v-if="openBlockers.length" class="max-h-80 space-y-2 overflow-y-auto">
                <div v-for="blocker in openBlockers" :key="blocker.id" class="border-l-2 border-rose-500 bg-rose-50 p-2.5 dark:bg-rose-950/30"><div class="flex items-start justify-between gap-2"><div><p class="text-sm">{{ blocker.content }}</p><p class="mt-1 text-xs text-gray-500">{{ blocker.participantName }} · {{ blocker.ageDays === 0 ? 'hoy' : `${blocker.ageDays} días abierto` }}</p></div><UButton icon="i-lucide-check" size="xs" color="green" variant="ghost" aria-label="Marcar blocker resuelto" @click="teamActions.resolveBlocker(blocker.id)" /></div></div>
              </div>
              <p v-else class="py-6 text-center text-sm text-gray-400">Sin blockers activos</p>
            </section>

            <section class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div class="mb-3 flex items-center justify-between"><h2 class="font-semibold">Action items</h2><UButton icon="i-lucide-plus" size="xs" color="cyan" variant="soft" @click="actionOpen = true">Nueva</UButton></div>
              <div v-if="selectedDaily.actions.length" class="space-y-2"><label v-for="action in selectedDaily.actions" :key="action.id" class="flex cursor-pointer items-start gap-2 rounded border border-gray-100 p-2 dark:border-gray-800"><UCheckbox :model-value="action.completed" @update:model-value="teamActions.toggleAction(action.id)" /><span class="min-w-0"><span class="block text-sm" :class="action.completed ? 'text-gray-400 line-through' : ''">{{ action.content }}</span><span class="text-xs text-gray-500">{{ action.assigneeName || 'Sin responsable' }}</span></span></label></div>
              <p v-else class="py-5 text-center text-sm text-gray-400">Sin acciones todavía</p>
            </section>

            <section class="rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-800 dark:bg-gray-900"><h2 class="mb-3 font-semibold">Indicadores del equipo</h2><dl class="grid grid-cols-2 gap-3"><div><dt class="text-xs text-gray-500">Media de dailys</dt><dd class="font-semibold">{{ state.team.metrics.averageDailyMinutes ?? '—' }} min</dd></div><div><dt class="text-xs text-gray-500">Resolución media</dt><dd class="font-semibold">{{ state.team.metrics.averageResolutionDays ?? '—' }} días</dd></div></dl><div v-if="state.team.metrics.recurringBlockers.length" class="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800"><p class="text-xs font-semibold uppercase text-gray-500">Recurrentes</p><p v-for="item in state.team.metrics.recurringBlockers" :key="item.content" class="mt-1 truncate">{{ item.content }} <span class="text-gray-500">×{{ item.count }}</span></p></div></section>
          </aside>
        </div>
      </template>

      <UModal v-model="actionOpen"><UCard><template #header><h2 class="font-semibold">Nueva acción</h2></template><div class="space-y-3"><UFormGroup label="Compromiso"><UTextarea v-model="actionForm.content" :rows="3" maxlength="500" /></UFormGroup><UFormGroup label="Responsable"><UInput v-model="actionForm.assigneeName" maxlength="80" /></UFormGroup></div><template #footer><div class="flex justify-end gap-2"><UButton color="gray" variant="ghost" @click="actionOpen = false">Cancelar</UButton><UButton color="cyan" :disabled="!actionForm.content.trim()" @click="createAction">Crear</UButton></div></template></UCard></UModal>
      <UModal v-model="createOpen"><UCard><template #header><h2 class="font-semibold">Preparar daily</h2></template><div class="space-y-3"><UFormGroup label="Fecha"><UInput v-model="createForm.date" type="date" /></UFormGroup><UFormGroup label="Formato"><USelectMenu v-model="createForm.mode" :options="modeOptions" value-attribute="value" option-attribute="label" /></UFormGroup><UFormGroup label="Segundos por participante"><UInput v-model.number="createForm.turnDurationSeconds" type="number" min="30" max="900" step="30" /></UFormGroup></div><template #footer><div class="flex justify-end gap-2"><UButton color="gray" variant="ghost" @click="createOpen = false">Cancelar</UButton><UButton color="cyan" @click="createDaily">Guardar</UButton></div></template></UCard></UModal>
    </template>
    <div v-else class="flex min-h-[70vh] items-center justify-center"><UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin text-cyan-500" /></div>
  </main>
</template>
