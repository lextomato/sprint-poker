import { mount } from "@vue/test-utils";
import RevealControls from "../components/RevealControls.vue";
import { describe, expect, it } from "vitest";

describe("RevealControls", () => {
  it("hides moderator controls for voters", () => {
    const wrapper = mount(RevealControls, {
      props: { canManage: false, isVoting: true, isRevealed: false, hasActiveStory: true },
      global: { stubs: ["UButton"] }
    });
    expect(wrapper.text()).toBe("");
  });

  it("shows reveal while voting", () => {
    const wrapper = mount(RevealControls, {
      props: { canManage: true, isVoting: true, isRevealed: false, hasActiveStory: true },
      global: { stubs: { UButton: { template: "<button><slot /></button>" } } }
    });
    expect(wrapper.text()).toContain("Revelar");
  });
});
