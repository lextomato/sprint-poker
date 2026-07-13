import { defineStore } from "pinia";
import type { RevealedVoteView, VoteStatistics, VoteStatusView } from "@planning/shared";

export const useVotingStore = defineStore("voting", {
  state: () => ({
    votes: [] as Array<VoteStatusView | RevealedVoteView>,
    statistics: null as VoteStatistics | null,
    selectedValue: null as string | null
  }),
  getters: {
    votedCount: (state) => state.votes.filter((vote) => vote.hasVoted).length
  },
  actions: {
    setVoting(votes: Array<VoteStatusView | RevealedVoteView>, statistics: VoteStatistics | null) {
      this.votes = votes;
      this.statistics = statistics;
    },
    select(value: string | null) {
      this.selectedValue = value;
    }
  }
});
