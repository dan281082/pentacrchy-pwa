import { useTrackingStore } from "../store";

describe("useTrackingStore", () => {
  beforeEach(() => useTrackingStore.getState().reset());

  it("defaults autoRefresh true, no expanded event", () => {
    const s = useTrackingStore.getState();
    expect(s.autoRefresh).toBe(true);
    expect(s.expandedEventId).toBeNull();
  });

  it("updates then resets", () => {
    useTrackingStore.getState().setAutoRefresh(false);
    useTrackingStore.getState().setExpandedEvent("e1");
    expect(useTrackingStore.getState().autoRefresh).toBe(false);
    expect(useTrackingStore.getState().expandedEventId).toBe("e1");
    useTrackingStore.getState().reset();
    expect(useTrackingStore.getState().autoRefresh).toBe(true);
    expect(useTrackingStore.getState().expandedEventId).toBeNull();
  });
});
