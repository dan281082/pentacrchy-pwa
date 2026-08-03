export const refillKeys = {
  all: ["refill-club"] as const,
  preferences: () => [...refillKeys.all, "preferences"] as const,
  plans: () => [...refillKeys.all, "plans"] as const,
};
