import { defineStore } from "pinia";
import type { RoomStateView } from "@planning/shared";

export const useRoomStore = defineStore("room", {
  state: () => ({
    state: null as RoomStateView | null
  }),
  getters: {
    room: (state) => state.state?.room ?? null,
    activeStory: (state) => state.state?.stories.find((story) => story.id === state.state?.room.activeStoryId) ?? null,
    isRevealed: (state) => state.state?.room.status === "REVEALED",
    isVoting: (state) => state.state?.room.status === "VOTING"
  },
  actions: {
    setState(next: RoomStateView) {
      const previousMe = this.state?.me;
      this.state = { ...next, me: next.me ?? previousMe };
    },
    clear() {
      this.state = null;
    }
  }
});
