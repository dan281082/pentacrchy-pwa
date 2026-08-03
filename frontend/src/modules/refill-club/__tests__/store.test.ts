import { useRefillStore } from "../store";

describe("useRefillStore", () => {
  beforeEach(() => useRefillStore.getState().reset());

  it("defaults the draft interval to 30 days", () => {
    expect(useRefillStore.getState().draftIntervalDays).toBe(30);
  });

  it("updates then resets", () => {
    useRefillStore.getState().setDraftInterval(60);
    expect(useRefillStore.getState().draftIntervalDays).toBe(60);
    useRefillStore.getState().reset();
    expect(useRefillStore.getState().draftIntervalDays).toBe(30);
  });
});
