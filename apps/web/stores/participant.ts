import { defineStore } from "pinia";
import type { ParticipantView } from "@planning/shared";

export const useParticipantStore = defineStore("participant", {
  state: () => ({
    me: null as ParticipantView | null,
    sessionToken: null as string | null
  }),
  getters: {
    isModerator: (state) => state.me?.role === "MODERATOR",
    canVote: (state) => state.me?.role !== "OBSERVER"
  },
  actions: {
    setSession(sessionToken: string, me?: ParticipantView) {
      this.sessionToken = sessionToken;
      if (me) {
        this.me = me;
      }
    },
    setMe(me?: ParticipantView) {
      if (me) {
        this.me = me;
      }
    }
  }
});
