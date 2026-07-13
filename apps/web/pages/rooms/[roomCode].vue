<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import type { RevealedVoteView, StoryView } from "@planning/shared";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const roomCode = computed(() => String(route.params.roomCode).toUpperCase());
const roomStore = useRoomStore();
const participantStore = useParticipantStore();
const storiesStore = useStoriesStore();
const votingStore = useVotingStore();
const roomSocket = useRoomSocket(roomCode.value);
const stories = useStories(roomCode.value);
const voting = useVoting(roomCode.value);
const participants = useParticipants(roomCode.value);
const sessionSummary = useSessionSummary(roomCode.value);
const lifecycle = useRoomLifecycle(roomCode.value);

const editorOpen = ref(false);
const editingStory = ref<StoryView | null>(null);
const confirmOpen = ref(false);
const pendingDeleteStoryId = ref<string | null>(null);
const finalEstimate = ref<string | undefined>(undefined);
const backlogOpen = ref(false);
const backlogCollapsed = ref(false);
const participantsOpen = ref(false);
const chatOpen = ref(false);
const summaryOpen = ref(false);
const reopenConfirmOpen = ref(false);
const summary = ref<import("@planning/shared").SessionSummaryView | null>(null);

const state = computed(() => roomStore.state);
const canManage = computed(() => participantStore.isModerator);
const activeStory = computed(() => roomStore.activeStory);
const isRoomClosed = computed(() => state.value?.room.status === "CLOSED");
const showRoundResults = computed(() => roomStore.isRevealed || isRoomClosed.value);
const showVotingArea = computed(() => Boolean(activeStory.value) && !showRoundResults.value);
const revealedVotes = computed(() => ((state.value?.votes ?? []).filter((vote): vote is RevealedVoteView => "value" in vote) as RevealedVoteView[]));
const { showApiError } = useApiErrors();

onMounted(async () => {
  const ok = await roomSocket.sync();
  if (!ok) {
    await router.push(`/join/${roomCode.value}`);
  }
});

useEventListener(window, "keydown", (event) => {
  const active = activeStory.value;
  if (!active || !participantStore.canVote || !roomStore.isVoting) return;
  const index = Number(event.key) - 1;
  const card = state.value?.room.deck[index];
  if (card) {
    void voting.submitVote(active.id, card);
  }
});

function openAddStory() {
  editingStory.value = null;
  editorOpen.value = true;
}

function openEditStory(story: StoryView) {
  editingStory.value = story;
  editorOpen.value = true;
}

async function saveStory(payload: { title: string; description?: string; acceptanceCriteria?: string }) {
  try {
    if (editingStory.value) {
      const ok = await stories.updateStory(editingStory.value.id, payload);
      if (!ok) return;
      toast.add({ color: "green", title: "Historia actualizada" });
      return;
    }
    const ok = await stories.createStory(payload);
    if (!ok) return;
    toast.add({ color: "green", title: "Historia creada" });
  } catch (error) {
    showApiError(error, "No se pudo guardar la historia");
  }
}

async function importStories(file: File) {
  try {
    const result = await stories.importStories(file);
    toast.add({ color: "green", title: `${result.imported} HDU importadas`, description: result.warnings.join(" ") || undefined });
  } catch (error) {
    showApiError(error, "No se pudo importar el archivo");
  }
}

function askDelete(storyId: string) {
  pendingDeleteStoryId.value = storyId;
  confirmOpen.value = true;
}

async function confirmDelete() {
  try {
    if (pendingDeleteStoryId.value) {
      await stories.deleteStory(pendingDeleteStoryId.value);
    }
  } catch (error) {
    showApiError(error, "No se pudo eliminar la historia");
  }
}

async function finalize() {
  if (!activeStory.value || !finalEstimate.value) return;
  try {
    const ok = await stories.finalizeStory(activeStory.value.id, finalEstimate.value);
    if (!ok) return;
    finalEstimate.value = undefined;
    toast.add({ color: "green", title: "Estimacion guardada" });
  } catch (error) {
    showApiError(error, "No se pudo guardar la estimacion");
  }
}

async function changeParticipantRole(participantId: string, role: "VOTER" | "OBSERVER") {
  try {
    const ok = await participants.updateRole(participantId, role);
    if (!ok) return;
    toast.add({ color: "green", title: "Rol actualizado" });
  } catch (error) {
    showApiError(error, "No se pudo actualizar el rol");
  }
}

async function removeParticipant(participantId: string) {
  try {
    const ok = await participants.removeParticipant(participantId);
    if (!ok) return;
    toast.add({ color: "green", title: "Participante expulsado" });
  } catch (error) {
    showApiError(error, "No se pudo expulsar al participante");
  }
}

async function openSummary() {
  try {
    summary.value = await sessionSummary.getSummary();
    summaryOpen.value = true;
  } catch (error) {
    showApiError(error, "No se pudo cargar el resumen");
  }
}

async function closeSession() {
  try {
    summary.value = await sessionSummary.closeSession();
    await roomSocket.sync();
    summaryOpen.value = true;
    toast.add({ color: "green", title: "Sesion finalizada" });
  } catch (error) {
    showApiError(error, "No se pudo terminar la sesion");
  }
}

async function reopenSession() {
  try {
    const ok = await lifecycle.reopenSession();
    if (!ok) return;
    toast.add({ color: "green", title: "Sesion reabierta" });
  } catch (error) {
    showApiError(error, "No se pudo reabrir la sesion");
  }
}
</script>

<template>
  <main class="page-shell min-h-screen px-4 py-4">
    <div v-if="state" class="mx-auto w-full max-w-none">
      <RoomHeader :state="state" />
      <UAlert
        v-if="isRoomClosed"
        class="mb-4 border border-red-300 bg-red-50 text-red-950 shadow-sm dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
        color="red"
        variant="soft"
        icon="i-lucide-lock"
        title="Sala cerrada"
        description="La sesion ya termino. Puedes revisar el resumen y descargar los resultados."
      />

      <div class="mb-3 flex gap-2 lg:hidden">
        <UButton icon="i-lucide-list" color="gray" variant="soft" @click="backlogOpen = true">Backlog</UButton>
        <UButton icon="i-lucide-users" color="gray" variant="soft" @click="participantsOpen = true">Participantes</UButton>
        <UButton icon="i-lucide-messages-square" color="gray" variant="soft" @click="chatOpen = true">Chat</UButton>
        <RevealControls :can-manage="canManage" :is-voting="roomStore.isVoting" :is-revealed="roomStore.isRevealed" :has-active-story="Boolean(activeStory)" @reveal="voting.revealRound" @restart="voting.restartRound" />
        <UButton icon="i-lucide-file-chart-column" color="gray" variant="soft" @click="openSummary">Resumen</UButton>
      </div>

      <div class="app-grid" :class="{ 'app-grid--backlog-collapsed': backlogCollapsed }">
        <div class="hidden lg:block">
          <div v-if="backlogCollapsed" class="flex h-full min-h-72 flex-col items-center gap-3 rounded-lg border border-gray-200 bg-white/90 p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
            <UButton icon="i-lucide-panel-left-open" color="gray" variant="soft" square aria-label="Mostrar backlog" @click="backlogCollapsed = false" />
            <div class="mt-1 flex flex-1 items-center justify-center">
              <span class="[writing-mode:vertical-rl] text-xs font-semibold uppercase tracking-wide text-gray-500">Backlog</span>
            </div>
            <UBadge color="gray" variant="subtle">{{ storiesStore.stories.length }}</UBadge>
          </div>
          <StoryBacklog v-else :stories="storiesStore.stories" :active-story-id="state.room.activeStoryId" :can-manage="canManage" collapsible @collapse="backlogCollapsed = true" @add="openAddStory" @import="importStories" @activate="stories.activateStory" @edit="openEditStory" @delete="askDelete" @skip="stories.skipStory" @reorder="stories.reorderStories" />
        </div>

        <div class="space-y-4">
          <div class="hidden flex-wrap justify-end gap-2 lg:flex">
            <RevealControls :can-manage="canManage" :is-voting="roomStore.isVoting" :is-revealed="roomStore.isRevealed" :has-active-story="Boolean(activeStory)" @reveal="voting.revealRound" @restart="voting.restartRound" />
            <UButton icon="i-lucide-file-chart-column" color="gray" variant="soft" @click="openSummary">Ver resumen</UButton>
            <UButton v-if="canManage && isRoomClosed" icon="i-lucide-unlock" color="amber" variant="soft" @click="reopenConfirmOpen = true">Reabrir sesión</UButton>
            <UButton v-if="canManage" icon="i-lucide-lock" color="red" variant="soft" :disabled="isRoomClosed" @click="closeSession">Terminar sesión</UButton>
          </div>
          <ActiveStoryCard :story="activeStory" :round="state.room.currentRound" :status="state.room.status" />
          <PlanningTable :participants="state.participants" :moderator-id="state.room.moderatorParticipantId" :votes="revealedVotes" :reactions="state.reactions" :status="state.room.status" />
          <VoteProgress v-if="showVotingArea" :participants="state.participants" />
          <VotingDeck v-if="showVotingArea && activeStory" :deck="state.room.deck" :selected="votingStore.selectedValue" :disabled="!participantStore.canVote || !roomStore.isVoting" @select="voting.submitVote(activeStory.id, $event)" />
          <VoteResults v-if="showRoundResults" v-model:final-estimate="finalEstimate" :votes="revealedVotes" :statistics="votingStore.statistics" :can-finalize="canManage && roomStore.isRevealed && Boolean(activeStory)" :deck="state.room.deck" :save-disabled="!finalEstimate" @finalize="finalize" />
        </div>

        <div class="hidden space-y-4 lg:block">
          <ParticipantsPanel :participants="state.participants" :moderator-id="state.room.moderatorParticipantId" :can-manage="canManage" :current-participant-id="participantStore.me?.id" @change-role="changeParticipantRole" @remove="removeParticipant" />
          <SessionChat :room-code="roomCode" :messages="state.chatMessages" :can-send="!isRoomClosed" />
        </div>
      </div>

      <USlideover v-model="backlogOpen" side="left">
        <StoryBacklog :stories="storiesStore.stories" :active-story-id="state.room.activeStoryId" :can-manage="canManage" @add="openAddStory" @import="importStories" @activate="stories.activateStory" @edit="openEditStory" @delete="askDelete" @skip="stories.skipStory" @reorder="stories.reorderStories" />
      </USlideover>
      <USlideover v-model="participantsOpen">
        <ParticipantsPanel :participants="state.participants" :moderator-id="state.room.moderatorParticipantId" :can-manage="canManage" :current-participant-id="participantStore.me?.id" @change-role="changeParticipantRole" @remove="removeParticipant" />
      </USlideover>
      <USlideover v-model="chatOpen">
        <SessionChat :room-code="roomCode" :messages="state.chatMessages" :can-send="!isRoomClosed" />
      </USlideover>
    </div>
    <div v-else class="mx-auto max-w-4xl py-20">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="mt-4 h-96 w-full" />
    </div>

    <StoryEditorModal v-model="editorOpen" :story="editingStory" @save="saveStory" />
    <ConfirmDialog v-model="confirmOpen" title="Eliminar historia" body="Esta accion no se puede deshacer." @confirm="confirmDelete" />
    <ConfirmDialog v-model="reopenConfirmOpen" title="Reabrir sesión" body="La sala volverá a quedar disponible para continuar el planning. Las HDU estimadas y el historial se conservan." @confirm="reopenSession" />
    <SessionSummaryModal v-model="summaryOpen" :summary="summary" @download-csv="summary && sessionSummary.downloadCsv(summary)" @download-xlsx="summary && sessionSummary.downloadXlsx(summary)" />
  </main>
</template>
