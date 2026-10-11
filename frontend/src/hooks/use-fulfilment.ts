import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { glpFulfilment, type FulfilmentDetail } from "@/src/api/glp/fulfilment";
import { useAuth } from "@/src/context/auth";

export const fulfilmentKeys = {
  all: ["fulfilment"] as const,
  detail: (id: number) => ["fulfilment", id] as const,
};

// Staff hooks — only enabled for accounts the server flags as fulfilment staff.
export function useFulfilmentOrders() {
  const { status, user } = useAuth();
  return useQuery({
    queryKey: fulfilmentKeys.all,
    queryFn: () => glpFulfilment.list(),
    enabled: status === "ready" && !!user?.fulfilment,
  });
}

export function useFulfilmentOrder(id: number) {
  const { status, user } = useAuth();
  return useQuery({
    queryKey: fulfilmentKeys.detail(id),
    queryFn: () => glpFulfilment.get(id),
    enabled: status === "ready" && !!user?.fulfilment && Number.isFinite(id),
  });
}

export function useFulfilmentAction(id: number, action: "ready" | "dispatch") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => (action === "ready" ? glpFulfilment.markReady(id) : glpFulfilment.dispatch(id)),
    onSuccess: (detail: FulfilmentDetail) => {
      qc.setQueryData(fulfilmentKeys.detail(id), detail);
      qc.invalidateQueries({ queryKey: fulfilmentKeys.all });
    },
  });
}
