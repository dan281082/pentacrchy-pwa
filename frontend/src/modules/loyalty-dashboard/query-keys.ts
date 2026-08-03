// Namespaced TanStack Query keys for the loyalty module.
export const loyaltyKeys = {
  all: ["loyalty"] as const,
  summary: () => [...loyaltyKeys.all, "summary"] as const,
};
