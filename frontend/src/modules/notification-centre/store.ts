import { create } from "zustand";

// LOCAL UI state only: optimistic "read" ids pending server sync + active tab.
type Tab = "inbox" | "settings";

interface NotificationUIState {
  optimisticRead: string[];
  activeTab: Tab;
  markReadLocal: (id: string) => void;
  setTab: (t: Tab) => void;
  reset: () => void;
}

const initial = { optimisticRead: [] as string[], activeTab: "inbox" as Tab };

export const useNotificationStore = create<NotificationUIState>((set) => ({
  ...initial,
  markReadLocal: (id) =>
    set((s) => (s.optimisticRead.includes(id) ? s : { optimisticRead: [...s.optimisticRead, id] })),
  setTab: (activeTab) => set({ activeTab }),
  reset: () => set({ optimisticRead: [], activeTab: "inbox" }),
}));
