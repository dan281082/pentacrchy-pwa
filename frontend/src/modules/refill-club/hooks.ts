import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useModuleAuth } from "@/src/modules/shared/use-module-auth";

import { refillApi } from "./api";
import { refillKeys } from "./query-keys";
import type { RefillPreferences } from "./types";

export function useRefillPreferences() {
  const { isAuthenticated } = useModuleAuth();
  return useQuery({
    queryKey: refillKeys.preferences(),
    queryFn: () => refillApi.getPreferences(),
    enabled: isAuthenticated,
  });
}

export function useRefillPlans() {
  const { isAuthenticated } = useModuleAuth();
  return useQuery({
    queryKey: refillKeys.plans(),
    queryFn: () => refillApi.getPlans(),
    enabled: isAuthenticated,
  });
}

export function useUpdateRefillPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: RefillPreferences) => refillApi.updatePreferences(prefs),
    onSuccess: (data) => qc.setQueryData(refillKeys.preferences(), data),
  });
}
