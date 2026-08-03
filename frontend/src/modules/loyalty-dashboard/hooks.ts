import { useQuery } from "@tanstack/react-query";

import { useModuleAuth } from "@/src/modules/shared/use-module-auth";

import { loyaltyApi } from "./api";
import { loyaltyKeys } from "./query-keys";

export function useLoyaltySummary() {
  const { isAuthenticated } = useModuleAuth();
  return useQuery({
    queryKey: loyaltyKeys.summary(),
    queryFn: () => loyaltyApi.getSummary(),
    enabled: isAuthenticated, // gated — no fabricated data when signed out
  });
}
