import {
  DEFAULT_REFILL_PREFERENCES,
  __PROVISIONAL_REFILL_PLANS_RAW,
  parseRefillPlans,
  parseRefillPreferences,
  refillApi,
} from "../api";

describe("parseRefillPreferences", () => {
  it("is consent-gated and OFF by default", () => {
    expect(DEFAULT_REFILL_PREFERENCES.enabled).toBe(false);
    expect(DEFAULT_REFILL_PREFERENCES.reminderConsent).toBe(false);
  });
  it("merges partial prefs over safe defaults", () => {
    const p = parseRefillPreferences({ enabled: true });
    expect(p.enabled).toBe(true);
    expect(p.reminderConsent).toBe(false);
    expect(p.defaultIntervalDays).toBe(30);
  });
});

describe("parseRefillPlans", () => {
  it("maps provisional plans (reminder only)", () => {
    const plans = parseRefillPlans(__PROVISIONAL_REFILL_PLANS_RAW);
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe("1");
    expect(plans[0].item.intervalDays).toBe(30);
    expect(plans[0].nextReminderDate).toBe("2026-06-01");
  });
});

describe("refillApi (mock adapter)", () => {
  it("returns disabled prefs and no fabricated plans", async () => {
    expect((await refillApi.getPreferences()).enabled).toBe(false);
    expect(await refillApi.getPlans()).toEqual([]);
  });
});
