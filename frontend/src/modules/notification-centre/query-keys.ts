export const notificationKeys = {
  all: ["notifications"] as const,
  inbox: () => [...notificationKeys.all, "inbox"] as const,
  preferences: () => [...notificationKeys.all, "preferences"] as const,
};
