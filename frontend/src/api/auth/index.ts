// Auth facade — the ONLY module the auth context imports. Swaps provider based
// on EXPO_PUBLIC_DATA_SOURCE (mock | live) with zero screen changes.

import { env } from "@/src/config/env";

import { liveAuthProvider } from "./live";
import { mockAuthProvider } from "./mock";
import { glpAuthProvider } from "../glp/auth";
import type { AuthProvider } from "./provider";

export const auth: AuthProvider =
  env.dataSource === "glp"
    ? glpAuthProvider
    : env.dataSource === "live"
      ? liveAuthProvider
      : mockAuthProvider;

export { AuthError } from "./provider";
