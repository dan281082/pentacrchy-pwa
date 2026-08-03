import { notificationRoute } from "../deep-link";

describe("notificationRoute", () => {
  it("routes order + reorder to Orders", () => {
    expect(notificationRoute({ category: "order" })).toEqual({ pathname: "/(tabs)/orders" });
    expect(notificationRoute({ category: "reorder" })).toEqual({ pathname: "/(tabs)/orders" });
  });
  it("routes restock/new-products to the product when a productId is present", () => {
    expect(notificationRoute({ category: "restock", data: { productId: 101 } })).toEqual({
      pathname: "/product/[id]",
      params: { id: "101" },
    });
    expect(notificationRoute({ category: "new-products" })).toEqual({ pathname: "/(tabs)/shop" });
  });
  it("routes loyalty + security to their modules", () => {
    expect(notificationRoute({ category: "loyalty" })).toEqual({
      pathname: "/module/[id]",
      params: { id: "loyalty-dashboard" },
    });
    expect(notificationRoute({ category: "security" })).toEqual({
      pathname: "/module/[id]",
      params: { id: "security-centre" },
    });
  });
});
