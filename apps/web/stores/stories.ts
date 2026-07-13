import { defineStore } from "pinia";
import type { StoryView } from "@planning/shared";

export const useStoriesStore = defineStore("stories", {
  state: () => ({
    stories: [] as StoryView[]
  }),
  getters: {
    pending: (state) => state.stories.filter((story) => story.status === "PENDING" || story.status === "ACTIVE"),
    estimated: (state) => state.stories.filter((story) => story.status === "ESTIMATED")
  },
  actions: {
    setStories(stories: StoryView[]) {
      this.stories = stories;
    }
  }
});
