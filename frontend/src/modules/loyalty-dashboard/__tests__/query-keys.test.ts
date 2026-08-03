import { loyaltyKeys } from "../query-keys";

describe("loyaltyKeys", () => {
  it("namespaces under 'loyalty'", () => {
    expect(loyaltyKeys.all).toEqual(["loyalty"]);
  });
  it("builds a stable summary key", () => {
    expect(loyaltyKeys.summary()).toEqual(["loyalty", "summary"]);
  });
});
