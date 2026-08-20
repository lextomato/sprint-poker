<script setup lang="ts">
import { DailyStatus, RoomStatus, RoomType, type DailySessionView, type RoomStateView } from "@planning/shared";
import type { RecentRoom } from "~/composables/useRecentRooms";
import type { TeamGadgetId } from "~/game/teamRoomWorld";
import { participantAvatar, teamAvatarImage } from "~/utils/teamAvatars";

const props = defineProps<{
  roomCode: string;
  state: RoomStateView;
  recentRooms: RecentRoom[];
}>();
const model = defineModel<TeamGadgetId | null>({ required: true });
const team = useTeam(props.roomCode);
const recent = useRecentRooms();
const selectedDailyId = ref("");
const noteDraft = ref("");
const noteBusy = ref(false);

const sessions = computed(() => props.state.team?.sessions ?? []);
const selectedDaily = computed(() => sessions.value.find((daily) => daily.id === selectedDailyId.value) ?? props.state.daily ?? sessions.value[0] ?? null);
const eligibleParticipants = computed(() => props.state.participants.filter((participant) => participant.role !== "OBSERVER"));
const planningRooms = computed(() => props.recentRooms.filter((room) => room.type === RoomType.PLANNING));
const retroRooms = computed(() => props.recentRooms.filter((room) => room.type === RoomType.RETROSPECTIVE));
const notes = computed(() => props.state.team?.notes ?? []);
const dailyOptions = computed(() => sessions.value.map((daily) => ({ label: formatDate(daily.date), value: daily.id })));

watch(model, (gadget) => {
  if (gadget === "daily-board") selectedDailyId.value = props.state.daily?.id ?? sessions.value[0]?.id ?? "";
});

function close() {
  model.value = null;
}

function entryFor(participantId: string, daily: DailySessionView | null = selectedDaily.value) {
  return daily?.entries.find((entry) => entry.participantId === participantId);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatLastSeen(value: string) {
  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function expiryLabel(value: string) {
  const remainingHours = Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 3600000));
  if (remainingHours < 24) return `Vence en ${remainingHours} h`;
  const days = Math.ceil(remainingHours / 24);
  return `Vence en ${days} ${days === 1 ? "dia" : "dias"}`;
}

function dailyStatus(status: DailyStatus) {
  if (status === DailyStatus.ACTIVE) return { label: "En curso", color: "green" as const };
  if (status === DailyStatus.COMPLETED) return { label: "Finalizada", color: "gray" as const };
  return { label: "Abierta", color: "cyan" as const };
}

function roomStatus(status: RoomStatus) {
  if (status === RoomStatus.CLOSED) return { label: "Cerrada", color: "gray" as const };
  if (status === RoomStatus.REVEALED) return { label: "Revelada", color: "green" as const };
  return { label: "Activa", color: "cyan" as const };
}

function roomPath(room: RecentRoom) {
  if (!recent.hasSession(room.code)) return `/join/${room.code}`;
  return room.type === RoomType.RETROSPECTIVE ? `/retrospectives/${room.code}` : `/rooms/${room.code}`;
}

async function publishNote() {
  const content = noteDraft.value.trim();
  if (!content || noteBusy.value) return;
  noteBusy.value = true;
  if (await team.createNote(content)) noteDraft.value = "";
  noteBusy.value = false;
}
</script>

<template>
  <UModal :model-value="Boolean(model)" :ui="{ width: 'w-full sm:max-w-5xl' }" @update:model-value="!$event && close()">
    <UCard class="max-h-[88vh] overflow-y-auto">
      <template #header>
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">
              {{ model === 'daily-board' ? 'Pizarra de Daily' : model === 'planning-table' ? 'Historial de Planning' : model === 'retro-board' ? 'Historial de Retros' : 'Tablon de Coffee' }}
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              {{ model === 'daily-board' ? 'Estado del equipo para el dia seleccionado.' : model === 'coffee-board' ? 'Notas compartidas que vencen automaticamente a los 7 dias.' : 'Sesiones recientes que puedes recuperar desde este dispositivo.' }}
            </p>
          </div>
          <UButton icon="i-lucide-x" color="gray" variant="ghost" aria-label="Cerrar" @click="close" />
        </div>
      </template>

      <template v-if="model === 'daily-board'">
        <div v-if="selectedDaily" class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <USelectMenu v-if="dailyOptions.length > 1" v-model="selectedDailyId" class="w-56" :options="dailyOptions" value-attribute="value" option-attribute="label" />
            <div v-else class="font-medium">{{ formatDate(selectedDaily.date) }}</div>
            <UBadge :color="dailyStatus(selectedDaily.status).color" variant="soft">{{ dailyStatus(selectedDaily.status).label }}</UBadge>
          </div>

          <div class="grid gap-3 sm:grid-cols-3">
            <div class="border-l-4 border-emerald-500 bg-gray-50 p-3 dark:bg-gray-800"><p class="text-xs text-gray-500">Participacion</p><p class="mt-1 text-xl font-semibold">{{ selectedDaily.participationRate }}%</p></div>
            <div class="border-l-4 border-rose-500 bg-gray-50 p-3 dark:bg-gray-800"><p class="text-xs text-gray-500">Blockers abiertos</p><p class="mt-1 text-xl font-semibold">{{ selectedDaily.blockers.filter(item => !item.resolvedAt).length }}</p></div>
            <div class="border-l-4 border-cyan-500 bg-gray-50 p-3 dark:bg-gray-800"><p class="text-xs text-gray-500">Actualizaciones</p><p class="mt-1 text-xl font-semibold">{{ selectedDaily.entries.length }} / {{ eligibleParticipants.length }}</p></div>
          </div>

          <div class="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
            <article v-for="participant in eligibleParticipants" :key="participant.id" class="p-3">
              <div class="flex items-center gap-3">
                <img :src="teamAvatarImage(participantAvatar(participant.avatarId, participant.id))" alt="" class="h-10 w-10 object-contain [image-rendering:pixelated]" />
                <div class="min-w-0 flex-1"><p class="font-medium">{{ participant.displayName }} <span v-if="entryFor(participant.id)?.mood">{{ entryFor(participant.id)?.mood }}</span></p><p class="text-xs" :class="entryFor(participant.id) ? 'text-emerald-600' : 'text-amber-600'">{{ entryFor(participant.id) ? 'Actualizado' : 'Pendiente' }}</p></div>
                <UIcon :name="entryFor(participant.id) ? 'i-lucide-circle-check' : 'i-lucide-clock-3'" :class="entryFor(participant.id) ? 'text-emerald-500' : 'text-amber-500'" />
              </div>
              <div v-if="entryFor(participant.id)" class="mt-3 grid gap-3 pl-12 text-sm md:grid-cols-2">
                <div><p class="text-xs font-semibold uppercase text-gray-500">Ayer</p><p class="mt-1 whitespace-pre-wrap">{{ entryFor(participant.id)?.yesterday || '-' }}</p></div>
                <div><p class="text-xs font-semibold uppercase text-gray-500">Hoy</p><p class="mt-1 whitespace-pre-wrap">{{ entryFor(participant.id)?.today || '-' }}</p></div>
              </div>
            </article>
          </div>
        </div>
        <div v-else class="py-12 text-center"><UIcon name="i-lucide-calendar-x" class="mx-auto h-8 w-8 text-gray-400" /><p class="mt-2 text-sm text-gray-500">Todavia no hay una Daily preparada.</p></div>
      </template>

      <template v-else-if="model === 'planning-table' || model === 'retro-board'">
        <div v-if="(model === 'planning-table' ? planningRooms : retroRooms).length" class="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
          <div v-for="room in (model === 'planning-table' ? planningRooms : retroRooms)" :key="room.code" class="flex items-center gap-3 p-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800"><UIcon :name="room.type === RoomType.PLANNING ? 'i-lucide-spade' : 'i-lucide-panels-top-left'" class="h-5 w-5" /></span>
            <div class="min-w-0 flex-1"><p class="truncate font-medium">{{ room.name }}</p><p class="text-xs text-gray-500">{{ room.code }} · {{ formatLastSeen(room.lastSeenAt) }}</p></div>
            <UBadge :color="roomStatus(room.status).color" variant="soft">{{ roomStatus(room.status).label }}</UBadge>
            <UButton :to="roomPath(room)" icon="i-lucide-arrow-up-right" color="gray" variant="soft">Abrir</UButton>
          </div>
        </div>
        <div v-else class="py-12 text-center"><UIcon name="i-lucide-history" class="mx-auto h-8 w-8 text-gray-400" /><p class="mt-2 text-sm text-gray-500">No hay sesiones recientes guardadas en este dispositivo.</p></div>
      </template>

      <template v-else-if="model === 'coffee-board'">
        <div class="space-y-4">
          <div class="flex items-end gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
            <UFormGroup class="min-w-0 flex-1" label="Nueva nota"><UTextarea v-model="noteDraft" :rows="2" maxlength="500" placeholder="Comparte un aviso, recordatorio o idea..." @keydown.ctrl.enter="publishNote" /></UFormGroup>
            <UButton icon="i-lucide-send" color="rose" :loading="noteBusy" :disabled="!noteDraft.trim()" @click="publishNote">Publicar</UButton>
          </div>

          <div v-if="notes.length" class="grid gap-3 md:grid-cols-2">
            <article v-for="note in notes" :key="note.id" class="relative border-l-4 border-rose-400 bg-gray-50 p-3 dark:bg-gray-800">
              <div class="flex items-start gap-3">
                <img :src="teamAvatarImage(participantAvatar(note.avatarId, note.participantId))" alt="" class="h-9 w-9 shrink-0 object-contain [image-rendering:pixelated]" />
                <div class="min-w-0 flex-1"><div class="flex items-center justify-between gap-2"><p class="text-sm font-semibold">{{ note.participantName }}</p><UButton v-if="note.canDelete" icon="i-lucide-trash-2" size="xs" color="red" variant="ghost" aria-label="Eliminar nota" @click="team.deleteNote(note.id)" /></div><p class="mt-1 whitespace-pre-wrap text-sm">{{ note.content }}</p><p class="mt-2 text-xs text-gray-500">{{ expiryLabel(note.expiresAt) }}</p></div>
              </div>
            </article>
          </div>
          <div v-else class="py-10 text-center"><UIcon name="i-lucide-sticky-note" class="mx-auto h-8 w-8 text-gray-400" /><p class="mt-2 text-sm text-gray-500">El tablon esta libre. Deja la primera nota.</p></div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="close">Cerrar</UButton>
          <UButton v-if="model === 'daily-board'" :to="`/teams/${roomCode}/daily`" icon="i-lucide-arrow-up-right" color="green">Abrir Daily completa</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
