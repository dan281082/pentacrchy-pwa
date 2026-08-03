import { trackingKeys } from "../query-keys";

describe("trackingKeys", () => {
  it("namespaces under 'tracking'", () => {
    expect(trackingKeys.all).toEqual(["tracking"]);
  });
  it("builds a per-order key", () => {
    expect(trackingKeys.order(1001)).toEqual(["tracking", "order", 1001]);
  });
});
