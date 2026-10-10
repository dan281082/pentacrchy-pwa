import type { Order } from "@/src/types/order";

// Contract shared by the mock and live (connector /me/orders) providers.
export interface OrdersProvider {
  list(accessToken: string): Promise<Order[]>;
  get(accessToken: string, id: number): Promise<Order | null>;
}
