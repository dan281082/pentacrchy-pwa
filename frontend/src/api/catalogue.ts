// Catalogue facade — the ONLY module screens/hooks import for catalogue data.
// Swaps provider based on EXPO_PUBLIC_DATA_SOURCE (mock | live) with zero UI
// changes. WooCommerce remains the single source of truth in live mode.

import { env } from "@/src/config/env";

import { mockProvider } from "./mock/provider";
import { liveProvider } from "./store-api";
import type { CatalogueProvider } from "./provider";

export const catalogue: CatalogueProvider =
  env.dataSource === "live" ? liveProvider : mockProvider;

export const activeDataSource = env.dataSource;
