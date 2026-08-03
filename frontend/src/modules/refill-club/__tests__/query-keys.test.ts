import { refillKeys } from "../query-keys";

describe("refillKeys", () => {
  it("namespaces under 'refill-club'", () => {
    expect(refillKeys.all).toEqual(["refill-club"]);
  });
  it("builds preferences + plans keys", () => {
    expect(refillKeys.preferences()).toEqual(["refill-club", "preferences"]);
    expect(refillKeys.plans()).toEqual(["refill-club", "plans"]);
  });
});
