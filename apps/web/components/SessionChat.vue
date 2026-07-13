<script setup lang="ts">
import type { ChatMessageView } from "@planning/shared";

const props = defineProps<{ roomCode: string; messages: ChatMessageView[]; canSend: boolean }>();

const chat = useRoomChat(props.roomCode);
const draft = ref("");
const gifOpen = ref(false);
const gifQuery = ref("");
const gifLoading = ref(false);
const gifs = ref<Array<{ id: string; title: string; url: string; previewUrl: string }>>([]);
const selectedGif = ref<{ url: string; title: string } | null>(null);
const messageList = ref<HTMLElement | null>(null);
const quickReactions = ["👍", "🙌", "🔥", "🤔", "😂", "☕"];

watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    if (messageList.value) {
      messageList.value.scrollTop = messageList.value.scrollHeight;
    }
  }
);

async function send() {
  if (!draft.value.trim() && !selectedGif.value) return;
  const ok = await chat.sendMessage(draft.value, selectedGif.value ?? undefined);
  if (ok) {
    draft.value = "";
    selectedGif.value = null;
    gifOpen.value = false;
  }
}

async function search() {
  if (!chat.giphyEnabled.value || !gifQuery.value.trim()) return;
  gifLoading.value = true;
  try {
    gifs.value = await chat.searchGifs(gifQuery.value);
  } finally {
    gifLoading.value = false;
  }
}

function pickGif(gif: { url: string; title: string }) {
  selectedGif.value = { url: gif.url, title: gif.title };
  gifOpen.value = false;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
</script>

<template>
  <section class="rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Chat</h2>
      <div class="flex gap-1">
        <UTooltip v-for="emoji in quickReactions" :key="emoji" text="Reaccionar">
          <button class="rounded-md px-1.5 py-1 text-base hover:bg-gray-100 dark:hover:bg-gray-800" :disabled="!canSend" @click="chat.sendReaction(emoji)">
            {{ emoji }}
          </button>
        </UTooltip>
      </div>
    </div>

    <div ref="messageList" class="max-h-80 min-h-48 space-y-3 overflow-y-auto pr-1">
      <EmptyState v-if="messages.length === 0" icon="i-lucide-messages-square" title="Sin mensajes" />
      <div v-for="message in messages" :key="message.id" class="rounded-md bg-gray-50 p-2 text-sm dark:bg-gray-800">
        <div class="mb-1 flex items-center justify-between gap-2">
          <span class="truncate font-medium text-gray-900 dark:text-white">{{ message.participantName }}</span>
          <span class="text-xs text-gray-500">{{ timeLabel(message.createdAt) }}</span>
        </div>
        <p v-if="message.content" class="whitespace-pre-wrap text-gray-700 dark:text-gray-200">{{ message.content }}</p>
        <img v-if="message.gifUrl" class="mt-2 max-h-36 rounded-md object-cover" :src="message.gifUrl" :alt="message.gifTitle ?? 'GIF'" loading="lazy" />
      </div>
    </div>

    <div v-if="selectedGif" class="mt-3 flex items-center justify-between gap-2 rounded-md border border-teal-200 bg-teal-50 p-2 dark:border-teal-900 dark:bg-teal-950/30">
      <img class="h-14 w-20 rounded object-cover" :src="selectedGif.url" :alt="selectedGif.title" />
      <UButton icon="i-lucide-x" color="gray" variant="ghost" size="xs" aria-label="Quitar GIF" @click="selectedGif = null" />
    </div>

    <div v-if="gifOpen" class="mt-3 rounded-md border border-gray-200 p-2 dark:border-gray-800">
      <div class="flex gap-2">
        <UInput v-model="gifQuery" class="min-w-0 flex-1" size="xs" placeholder="Buscar GIF" @keyup.enter="search" />
        <UButton icon="i-lucide-search" color="gray" variant="soft" size="xs" :loading="gifLoading" @click="search" />
      </div>
      <div v-if="gifs.length" class="mt-2 grid grid-cols-4 gap-2">
        <button v-for="gif in gifs" :key="gif.id" class="overflow-hidden rounded border border-gray-200 dark:border-gray-800" @click="pickGif(gif)">
          <img class="h-16 w-full object-cover" :src="gif.previewUrl" :alt="gif.title" loading="lazy" />
        </button>
      </div>
      <p class="mt-2 text-[11px] font-medium text-gray-500">Powered by GIPHY</p>
    </div>

    <div class="mt-3 flex gap-2">
      <UInput v-model="draft" class="min-w-0 flex-1" placeholder="Mensaje" :disabled="!canSend" maxlength="500" @keyup.enter="send" />
      <UButton v-if="chat.giphyEnabled.value" icon="i-lucide-image" color="gray" variant="soft" :disabled="!canSend" aria-label="GIF" @click="gifOpen = !gifOpen" />
      <UButton icon="i-lucide-send" color="teal" :disabled="!canSend || (!draft.trim() && !selectedGif)" aria-label="Enviar" @click="send" />
    </div>
  </section>
</template>
