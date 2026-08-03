import { __PROVISIONAL_TRACKING_RAW, parseTracking, trackingApi } from "../api";

describe("parseTracking", () => {
  it("maps the provisional wire payload", () => {
    const t = parseTracking(__PROVISIONAL_TRACKING_RAW);
    expect(t.orderId).toBe(1001);
    expect(t.courier).toBe("Royal Mail");
    expect(t.trackingNumber).toBe("AB123456789GB");
    expect(t.estimatedDelivery).toBeNull(); // never invented
    expect(t.events).toHaveLength(1);
    expect(t.events[0].id).toBe("1");
  });

  it("returns nulls + empty events for a sparse payload", () => {
    const t = parseTracking({ order_id: 5 });
    expect(t.courier).toBeNull();
    expect(t.events).toEqual([]);
    expect(t.estimatedDelivery).toBeNull();
  });
});

describe("trackingApi (mock adapter)", () => {
  it("never fabricates courier events or dates", async () => {
    const t = await trackingApi.getTracking(1001);
    expect(t.events).toEqual([]);
    expect(t.dispatchDate).toBeNull();
    expect(t.estimatedDelivery).toBeNull();
  });
});
