// Persistent local favourites (Zustand + storage).
// Phase 1: stored locally for everyone. When customer auth (Apeps App Connector)
// lands in Phase 2, these merge into the account with duplicate handling.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "./persist";

interface FavouritesState {
  ids: number[];
  toggle: (id: number) => void;
  add: (id: number) => void;
  remove: (id: number) => void;
  isFavourite: (id: number) => boolean;
  clear: () => void;
}

export const useFavouritesStore = create<FavouritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set((s) => ({
          ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [id, ...s.ids],
        })),
      add: (id) => set((s) => (s.ids.includes(id) ? s : { ids: [id, ...s.ids] })),
      remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
      isFavourite: (id) => get().ids.includes(id),
      clear: () => set({ ids: [] }),
    }),
    {
      name: "apeps.favourites.v1",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
