import { useEffect } from "react";
import { create } from "zustand";

export interface DashboardHeaderData {
  behavioralHook: string | null;
  progressCompleted: number;
  progressTotal: number;
  isComplete: boolean;
}

// ─── Global Zustand store ─────────────────────────────────────────────────────
// Zustand is used instead of React Context because the Header (consumer) and
// DashboardPage (producer) are siblings in the route tree — not in a
// parent-child relationship — so Context can't flow between them.
interface DashboardHeaderStore {
  data: DashboardHeaderData | null;
  setData: (data: DashboardHeaderData | null) => void;
}

const useDashboardHeaderStore = create<DashboardHeaderStore>((set) => ({
  data: null,
  setData: (data) => set({ data }),
}));

// ─── Consumer hook — reads the store (Header uses this) ──────────────────────
export function useDashboardHeader(): DashboardHeaderData | null {
  return useDashboardHeaderStore((s) => s.data);
}

// ─── Producer hook — writes to the store (DashboardPage uses this) ───────────
// Automatically resets to null when the component unmounts (leaving the page).
export function useDashboardHeaderWriter(data: DashboardHeaderData) {
  const setData = useDashboardHeaderStore((s) => s.setData);

  useEffect(() => {
    setData(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, setData]);

  // Reset to null when DashboardPage unmounts so non-dashboard pages don't
  // incorrectly show the greeting and progress ring.
  useEffect(() => {
    return () => {
      setData(null);
    };
  }, [setData]);
}
