import { create } from "zustand";

// Types
interface DependencyStatus {
  name: string;
  installed: boolean;
  size: number;
  version?: string;
  license?: string;
  projectUrl?: string;
}

interface LauncherProgress {
  name: string;
  downloaded: number;
  total: number;
  percent: number;
  status: "downloading" | "extracting" | "verifying" | "complete" | "error";
}

interface LauncherState {
  dependencies: DependencyStatus[];
  progress: Record<string, LauncherProgress>;
  error: string | null;

  // Actions
  setDependencies: (deps: DependencyStatus[]) => void;
  updateProgress: (progress: LauncherProgress) => void;
  setError: (error: string) => void;
  reset: () => void;
}

export const useLauncherStore = create<LauncherState>((set) => ({
  dependencies: [],
  progress: {},
  error: null,

  setDependencies: (deps) => set({ dependencies: deps }),

  updateProgress: (progress) =>
    set((state) => ({
      progress: { ...state.progress, [progress.name]: progress },
    })),

  setError: (error) => set({ error }),

  reset: () =>
    set({ dependencies: [], progress: {}, error: null }),
}));
