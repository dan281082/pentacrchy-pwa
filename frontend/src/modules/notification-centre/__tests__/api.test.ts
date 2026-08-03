import {
  DEFAULT_PREFERENCES,
  __PROVISIONAL_NOTIFICATIONS_RAW,
  notificationApi,
  parseNotifications,
  parsePreferences,
} from "../api";

describe("parseNotifications", () => {
  it("maps the provisional payload and coerces ids", () => {
    const list = parseNotifications(__PROVISIONAL_NOTIFICATIONS_RAW);
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe("1");
    expect(list[0].category).toBe("order");
    expect(list[1].data?.productId).toBe(101);
  });
});

describe("parsePreferences", () => {
  it("defaults marketing OFF, transactional ON", () => {
    expect(DEFAULT_PREFERENCES.orderUpdates).toBe(true);
    expect(DEFAULT_PREFERENCES.offers).toBe(false);
  });
  it("merges partial server prefs over safe defaults", () => {
    const p = parsePreferences({ offers: true });
    expect(p.offers).toBe(true);
    expect(p.orderUpdates).toBe(true);
    expect(p.reorderReminders).toBe(false);
  });
});

describe("notificationApi (mock adapter)", () => {
  it("returns an empty inbox and default (marketing-off) prefs", async () => {
    expect(await notificationApi.getInbox()).toEqual([]);
    const prefs = await notificationApi.getPreferences();
    expect(prefs.offers).toBe(false);
  });
});
