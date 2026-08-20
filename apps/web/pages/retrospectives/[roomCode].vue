<script setup lang="ts">
import { ClientEvents, RoomType, type RetroCardView } from "@planning/shared";
import { useRetrospective } from "~/composables/useRetrospective";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const roomCode = computed(() => String(route.params.roomCode).toUpperCase());
const roomStore = useRoomStore();
const participantStore = useParticipantStore();
const roomSocket = useRoomSocket(roomCode.value);
const retro = useRetrospective(roomCode.value);
const participants = useParticipants(roomCode.value);
const state = computed(() => roomStore.state);
const board = computed(() => state.value?.retrospective);
const canManage = computed(() => participantStore.isModerator);
const canContribute = computed(() => participantStore.canVote && state.value?.room.status !== "CLOSED");
const sidebarOpen = ref(false);
const actionOpen = ref(false);
const actionForm = reactive({ content: "", assigneeName: "", cardId: null as string | null });
const confirmOpen = ref(false);
const pendingDelete = ref<{ type: "card" | "action"; id: string } | null>(null);
const reopenOpen = ref(false);

onMounted(async () => {
  const ok = await roomSocket.sync();
  if (!ok) await router.push(`/join/${roomCode.value}`);
});

watch(
  () => state.value?.room.type,
  (type) => {
    if (type === RoomType.PLANNING) void router.replace(`/rooms/${roomCode.value}`);
  }
);

function openAction(card?: RetroCardView) {
  actionForm.content = card ? `Dar seguimiento a: ${card.content}` : "";
  actionForm.assigneeName = "";
  actionForm.cardId = card?.id ?? null;
  actionOpen.value = true;
}

async function createAction() {
  if (!actionForm.content.trim()) return;
  const ok = await retro.createAction(actionForm.content, actionForm.assigneeName || null, actionForm.cardId);
  if (ok) {
    actionOpen.value = false;
    toast.add({ color: "green", title: "Acción creada" });
  }
}

function askDelete(type: "card" | "action", id: string) {
  pendingDelete.value = { type, id };
  confirmOpen.value = true;
}

async function confirmDelete() {
  if (!pendingDelete.value) return;
  const ok = pendingDelete.value.type === "card" ? await retro.deleteCard(pendingDelete.value.id) : await retro.deleteAction(pendingDelete.value.id);
  if (ok) toast.add({ color: "green", title: pendingDelete.value.type === "card" ? "Tarjeta eliminada" : "Acción eliminada" });
  pendingDelete.value = null;
}

async function closeRoom() {
  const response = await roomSocket.emit(ClientEvents.ROOM_CLOSE, roomSocket.withSession());
  if (response.ok) toast.add({ color: "green", title: "Retrospectiva finalizada" });
}

async function reopenRoom() {
  const response = await roomSocket.emit(ClientEvents.ROOM_REOPEN, roomSocket.withSession());
  if (response.ok) {
    reopenOpen.value = false;
    toast.add({ color: "green", title: "Retrospectiva reabierta" });
  }
}

async function changeRole(participantId: string, role: "VOTER" | "OBSERVER") {
  if (await participants.updateRole(participantId, role)) toast.add({ color: "green", title: "Rol actualizado" });
}

async function removeParticipant(participantId: string) {
  if (await participants.removeParticipant(participantId)) toast.add({ color: "green", title: "Participante expulsado" });
}
</script>

<template>
  <main class="min-h-screen bg-gray-100 p-3 dark:bg-gray-950 sm:p-4">
    <template v-if="state && board">
      <RoomHeader :state="state" />

      <div v-if="state.room.status === 'CLOSED'" class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
        <div class="flex items-center gap-2"><UIcon name="i-lucide-lock" class="h-5 w-5" /><span class="font-medium">Esta retrospectiva está cerrada. El tablero queda en modo lectura.</span></div>
        <UButton v-if="canManage" icon="i-lucide-lock-open" color="red" variant="soft" size="sm" @click="reopenOpen = true">Reabrir</UButton>
      </div>

      <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <p class="text-sm font-semibold text-gray-900 dark:text-white">Tablero de reflexión</p>
          <p class="text-xs text-gray-500">Añade ideas, vota los temas importantes y crea acuerdos.</p>
        </div>
        <div class="flex items-center gap-2">
          <UButton class="lg:hidden" icon="i-lucide-users" color="gray" variant="soft" @click="sidebarOpen = true">Equipo</UButton>
          <UButton v-if="canManage && state.room.status !== 'CLOSED'" icon="i-lucide-lock" color="red" variant="soft" @click="closeRoom">Finalizar</UButton>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div class="min-w-0 space-y-4">
          <div class="overflow-x-auto pb-2">
            <RetroBoard
              :columns="board.columns"
              :cards="board.cards"
              :can-contribute="canContribute"
              :current-participant-id="state.me?.id"
              :moderator-id="state.room.moderatorParticipantId"
              :closed="state.room.status === 'CLOSED'"
              @create="retro.createCard"
              @update="retro.updateCard"
              @delete="(id: string) => askDelete('card', id)"
              @move="retro.moveCard"
              @vote="retro.toggleVote"
              @comment="retro.createComment"
              @delete-comment="retro.deleteComment"
              @reaction="retro.toggleReaction"
              @action="openAction"
            />
          </div>
          <RetroActions :actions="board.actions" :can-contribute="canContribute" :can-manage="canManage" :closed="state.room.status === 'CLOSED'" @create="openAction()" @toggle="retro.toggleAction" @delete="(id: string) => askDelete('action', id)" />
        </div>

        <aside class="hidden space-y-4 lg:block">
          <ParticipantsPanel :participants="state.participants" :moderator-id="state.room.moderatorParticipantId" :can-manage="canManage" :current-participant-id="state.me?.id" @change-role="changeRole" @remove="removeParticipant" />
          <SessionChat :room-code="roomCode" :messages="state.chatMessages" :can-send="state.room.status !== 'CLOSED'" />
        </aside>
      </div>

      <USlideover v-model="sidebarOpen">
        <div class="space-y-4 p-4">
          <div class="flex justify-end"><UButton icon="i-lucide-x" color="gray" variant="ghost" @click="sidebarOpen = false" /></div>
          <ParticipantsPanel :participants="state.participants" :moderator-id="state.room.moderatorParticipantId" :can-manage="canManage" :current-participant-id="state.me?.id" @change-role="changeRole" @remove="removeParticipant" />
          <SessionChat :room-code="roomCode" :messages="state.chatMessages" :can-send="state.room.status !== 'CLOSED'" />
        </div>
      </USlideover>

      <UModal v-model="actionOpen">
        <UCard>
          <template #header><h2 class="font-semibold">Nueva acción</h2></template>
          <div class="space-y-4">
            <UFormGroup label="Compromiso" required><UTextarea v-model="actionForm.content" :rows="4" maxlength="500" /></UFormGroup>
            <UFormGroup label="Responsable"><UInput v-model="actionForm.assigneeName" maxlength="80" placeholder="Nombre o equipo" /></UFormGroup>
          </div>
          <template #footer><div class="flex justify-end gap-2"><UButton color="gray" variant="ghost" @click="actionOpen = false">Cancelar</UButton><UButton color="teal" icon="i-lucide-check" :disabled="!actionForm.content.trim()" @click="createAction">Crear acción</UButton></div></template>
        </UCard>
      </UModal>

      <ConfirmDialog v-model="confirmOpen" title="Eliminar elemento" body="Esta acción no se puede deshacer." @confirm="confirmDelete" />
      <UModal v-model="reopenOpen"><UCard><template #header><h2 class="font-semibold">Reabrir retrospectiva</h2></template><p class="text-gray-600 dark:text-gray-300">El equipo podrá volver a añadir tarjetas, votar y editar acciones.</p><template #footer><div class="flex justify-end gap-2"><UButton color="gray" variant="ghost" @click="reopenOpen = false">Cancelar</UButton><UButton color="teal" icon="i-lucide-lock-open" @click="reopenRoom">Reabrir</UButton></div></template></UCard></UModal>
    </template>
    <div v-else class="flex min-h-[70vh] items-center justify-center"><UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin text-teal-500" /></div>
  </main>
</template>
