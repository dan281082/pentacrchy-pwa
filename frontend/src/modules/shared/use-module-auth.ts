// Temporary authentication stub for ecosystem modules.
// Phase 2 replaces this with the real AuthContext backed by the Apeps App
// Connector (SecureStore tokens). Until then, modules that require sign-in
// resolve to "unauthorised" and NEVER display fabricated customer data.

export interface ModuleAuthState {
  isAuthenticated: boolean;
  customerId: number | null;
}

export function useModuleAuth(): ModuleAuthState {
  // No customer auth in Phase 1.
  return { isAuthenticated: false, customerId: null };
}
