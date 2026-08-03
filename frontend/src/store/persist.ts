// Zustand persist adapter backed by the app's shared storage util.
// Uses the general KV namespace (AsyncStorage) — NOT secure storage — because
// basket / favourites / recently-viewed are non-sensitive.
// storage.* auto JSON-serialises strings and round-trips them, so we implement
// zustand's StateStorage (string-based) directly.

import type { StateStorage } from "zustand/middleware";

import { storage } from "@/src/utils/storage";

export const zustandStorage: StateStorage = {
  getItem: async (name) => ((await storage.getItem(name, null)) as string | null) ?? null,
  setItem: async (name, value) => {
    await storage.setItem(name, value);
  },
  removeItem: async (name) => {
    await storage.removeItem(name);
  },
};
