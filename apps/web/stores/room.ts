import { defineStore } from "pinia";
import type { RoomStateView, TeamPositionEvent } from "@planning/shared";

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
    patchTeamPosition(event: TeamPositionEvent) {
      if (!this.state) return;
      const patch = (participant: RoomStateView["participants"][number]) => participant.id === event.participantId
        ? { ...participant, positionX: event.x, positionY: event.y, zone: event.zone, lastActivityAt: event.updatedAt, connected: true }
        : participant;
      this.state = {
        ...this.state,
        me: this.state.me ? patch(this.state.me) : undefined,
        participants: this.state.participants.map(patch)
      };
    },
    clear() {
      this.state = null;
    }
  }
});
