import { create } from "zustand";

// LOCAL UI state only.
interface TrackingUIState {
  autoRefresh: boolean;
  expandedEventId: string | null;
  setAutoRefresh: (v: boolean) => void;
  setExpandedEvent: (id: string | null) => void;
  reset: () => void;
}

const initial = { autoRefresh: true, expandedEventId: null as string | null };

export const useTrackingStore = create<TrackingUIState>((set) => ({
  ...initial,
  setAutoRefresh: (autoRefresh) => set({ autoRefresh }),
  setExpandedEvent: (expandedEventId) => set({ expandedEventId }),
  reset: () => set({ ...initial }),
}));
