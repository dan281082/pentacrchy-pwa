// Recently viewed products (ids) + recent searches. Local, non-sensitive.

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "./persist";

const MAX_VIEWED = 12;
const MAX_SEARCHES = 8;

interface HistoryState {
  viewedIds: number[];
  recentSearches: string[];
  pushViewed: (id: number) => void;
  pushSearch: (term: string) => void;
  removeSearch: (term: string) => void;
  clearSearches: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      viewedIds: [],
      recentSearches: [],
      pushViewed: (id) =>
        set((s) => ({
          viewedIds: [id, ...s.viewedIds.filter((x) => x !== id)].slice(0, MAX_VIEWED),
        })),
      pushSearch: (term) =>
        set((s) => {
          const t = term.trim();
          if (!t) return s;
          return {
            recentSearches: [t, ...s.recentSearches.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, MAX_SEARCHES),
          };
        }),
      removeSearch: (term) =>
        set((s) => ({ recentSearches: s.recentSearches.filter((x) => x !== term) })),
      clearSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: "apeps.history.v1",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
