import type { ModuleViewStatus } from "./ModuleStateView";

// Maps auth + connectivity + a TanStack Query result into a ModuleViewStatus.
export function deriveModuleStatus(opts: {
  isAuthenticated: boolean;
  requiresAuth?: boolean;
  isOnline?: boolean;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
}): ModuleViewStatus {
  const { isAuthenticated, requiresAuth = true, isOnline = true, isLoading, isError, isEmpty } = opts;
  if (requiresAuth && !isAuthenticated) return "unauthorised";
  if (isLoading) return "loading";
  if (isError) return isOnline ? "error" : "offline";
  if (isEmpty) return "empty";
  return "ready";
}
