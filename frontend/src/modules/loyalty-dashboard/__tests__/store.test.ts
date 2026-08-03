import { useLoyaltyStore } from "../store";

describe("useLoyaltyStore", () => {
  beforeEach(() => useLoyaltyStore.getState().reset());

  it("defaults the activity filter to 'all'", () => {
    expect(useLoyaltyStore.getState().activityFilter).toBe("all");
  });

  it("updates then resets to defaults", () => {
    useLoyaltyStore.getState().setActivityFilter("earned");
    expect(useLoyaltyStore.getState().activityFilter).toBe("earned");
    useLoyaltyStore.getState().reset();
    expect(useLoyaltyStore.getState().activityFilter).toBe("all");
  });
});
