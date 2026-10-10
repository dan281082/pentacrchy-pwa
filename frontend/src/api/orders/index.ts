// Orders facade — swaps provider by EXPO_PUBLIC_DATA_SOURCE (mock | live).

import { env } from "@/src/config/env";

import { liveOrdersProvider } from "./live";
import { mockOrdersProvider } from "./mock";
import type { OrdersProvider } from "./provider";

export const orders: OrdersProvider =
  env.dataSource === "live" ? liveOrdersProvider : mockOrdersProvider;
