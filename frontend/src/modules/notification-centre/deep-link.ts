import type { AppNotification, NotificationCategory, NotificationData } from "./types";

// Pure deep-link routing for an opened notification. Returns an expo-router
// href object or null. PROVISIONAL destinations — order/tracking screens land
// in Phase 2; product/collection/loyalty routes already exist.
export type NotificationHref = { pathname: string; params?: Record<string, string> } | null;

export function notificationRoute(input: {
  category: NotificationCategory;
  data?: NotificationData;
}): NotificationHref {
  const { category, data } = input;
  switch (category) {
    case "order":
    case "reorder":
      return { pathname: "/(tabs)/orders" };
    case "tracking":
      // Phase 2: deep-link to the specific order's tracking.
      return data?.orderId
        ? { pathname: "/(tabs)/orders", params: { orderId: String(data.orderId) } }
        : { pathname: "/(tabs)/orders" };
    case "restock":
    case "new-products":
      return data?.productId
        ? { pathname: "/product/[id]", params: { id: String(data.productId) } }
        : { pathname: "/(tabs)/shop" };
    case "offers":
      return { pathname: "/(tabs)/shop" };
    case "loyalty":
      return { pathname: "/module/[id]", params: { id: "loyalty-dashboard" } };
    case "security":
      return { pathname: "/module/[id]", params: { id: "security-centre" } };
    default:
      return null;
  }
}

export const routeForNotification = (n: AppNotification): NotificationHref =>
  notificationRoute({ category: n.category, data: n.data });
