export const trackingKeys = {
  all: ["tracking"] as const,
  order: (orderId: number) => [...trackingKeys.all, "order", orderId] as const,
};
