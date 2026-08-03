import { useQuery } from "@tanstack/react-query";

import { useModuleAuth } from "@/src/modules/shared/use-module-auth";

import { trackingApi } from "./api";
import { trackingKeys } from "./query-keys";

export function useOrderTracking(orderId: number | null) {
  const { isAuthenticated } = useModuleAuth();
  return useQuery({
    queryKey: orderId ? trackingKeys.order(orderId) : trackingKeys.all,
    queryFn: () => trackingApi.getTracking(orderId as number),
    enabled: isAuthenticated && !!orderId,
  });
}
