import { useQuery } from "@tanstack/react-query";

import { orders } from "@/src/api/orders";
import { useAuth } from "@/src/context/auth";

export const orderKeys = {
  all: ["orders"] as const,
  detail: (id: number) => ["orders", id] as const,
};

export function useOrders() {
  const { status, accessToken } = useAuth();
  return useQuery({
    queryKey: orderKeys.all,
    queryFn: () => orders.list(accessToken ?? ""),
    enabled: status === "ready" && !!accessToken,
  });
}

export function useOrder(id: number) {
  const { status, accessToken } = useAuth();
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => orders.get(accessToken ?? "", id),
    enabled: status === "ready" && !!accessToken && Number.isFinite(id),
  });
}
