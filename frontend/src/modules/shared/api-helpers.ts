// Shared helpers for module API adapters that will call the secure Apeps App
// Connector (WordPress plugin) in Phase 2. All endpoint paths defined in each
// module's api.ts are PROVISIONAL until the plugin is installed and tested.

import { ApiError } from "@/src/api/errors";
import { env } from "@/src/config/env";

/** Build an App Connector URL, or throw a typed "not configured" error. */
export function appApiUrl(path: string): string {
  if (!env.appApiBaseUrl) {
    throw new ApiError(
      "server",
      "Apeps App Connector is not configured (EXPO_PUBLIC_API_BASE_URL).",
    );
  }
  return `${env.appApiBaseUrl.replace(/\/$/, "")}${path}`;
}

/** Guard used by live adapters until the connector endpoints exist. */
export function assertConnectorAvailable(): void {
  if (!env.appApiBaseUrl) {
    throw new ApiError("server", "This feature requires the Apeps App Connector.");
  }
}
