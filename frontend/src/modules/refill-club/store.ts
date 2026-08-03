import { create } from "zustand";

// LOCAL UI state only: the interval currently selected in the picker.
interface RefillUIState {
  draftIntervalDays: number;
  setDraftInterval: (days: number) => void;
  reset: () => void;
}

const INITIAL_INTERVAL = 30;

export const useRefillStore = create<RefillUIState>((set) => ({
  draftIntervalDays: INITIAL_INTERVAL,
  setDraftInterval: (draftIntervalDays) => set({ draftIntervalDays }),
  reset: () => set({ draftIntervalDays: INITIAL_INTERVAL }),
}));

export const REFILL_INTERVAL_OPTIONS = [14, 30, 60, 90];
