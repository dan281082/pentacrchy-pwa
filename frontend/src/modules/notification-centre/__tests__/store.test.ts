import { useNotificationStore } from "../store";

describe("useNotificationStore", () => {
  beforeEach(() => useNotificationStore.getState().reset());

  it("starts empty on the inbox tab", () => {
    const s = useNotificationStore.getState();
    expect(s.optimisticRead).toEqual([]);
    expect(s.activeTab).toBe("inbox");
  });

  it("marks read locally (deduped) then resets", () => {
    useNotificationStore.getState().markReadLocal("n1");
    useNotificationStore.getState().markReadLocal("n1");
    useNotificationStore.getState().setTab("settings");
    expect(useNotificationStore.getState().optimisticRead).toEqual(["n1"]);
    expect(useNotificationStore.getState().activeTab).toBe("settings");
    useNotificationStore.getState().reset();
    expect(useNotificationStore.getState().optimisticRead).toEqual([]);
    expect(useNotificationStore.getState().activeTab).toBe("inbox");
  });
});
