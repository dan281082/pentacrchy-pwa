import { create } from "zustand";

// LOCAL UI state only — no server data is duplicated here.
export type LoyaltyActivityFilter = "all" | "earned" | "redeemed";

interface LoyaltyUIState {
  activityFilter: LoyaltyActivityFilter;
  setActivityFilter: (f: LoyaltyActivityFilter) => void;
  reset: () => void;
}

const initial: Pick<LoyaltyUIState, "activityFilter"> = { activityFilter: "all" };

export const useLoyaltyStore = create<LoyaltyUIState>((set) => ({
  ...initial,
  setActivityFilter: (activityFilter) => set({ activityFilter }),
  reset: () => set({ ...initial }),
}));
