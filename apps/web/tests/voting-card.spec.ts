import { mount } from "@vue/test-utils";
import VotingCard from "../components/VotingCard.vue";
import { describe, expect, it } from "vitest";

describe("VotingCard", () => {
  it("emits the selected value", async () => {
    const wrapper = mount(VotingCard, { props: { value: "8", selected: false } });
    await wrapper.trigger("click");
    expect(wrapper.emitted("select")?.[0]).toEqual(["8"]);
  });
});
