import { __PROVISIONAL_LOYALTY_RAW, loyaltyApi, parseLoyaltySummary } from "../api";

describe("parseLoyaltySummary", () => {
  it("maps the provisional wire payload into the domain shape", () => {
    const s = parseLoyaltySummary(__PROVISIONAL_LOYALTY_RAW);
    expect(s.enabled).toBe(true);
    expect(s.points).toBe(1200);
    expect(s.redemptionValue).toEqual({ amountMinor: "1200", currency: "GBP" });
    expect(s.tier).toBe("Silver");
    expect(s.activity).toHaveLength(2);
    expect(s.activity[0].id).toBe("1"); // coerced to string
  });

  it("tolerates a sparse payload without inventing a balance", () => {
    const s = parseLoyaltySummary({});
    expect(s.enabled).toBe(false);
    expect(s.points).toBeNull();
    expect(s.activity).toEqual([]);
  });
});

describe("loyaltyApi (mock adapter)", () => {
  it("never fabricates a points balance", async () => {
    const s = await loyaltyApi.getSummary();
    expect(s.enabled).toBe(false);
    expect(s.points).toBeNull();
  });
});
