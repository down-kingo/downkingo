import { create } from "zustand";

/**
 * Download interface - matches storage.Download from Go backend
 * Using interface instead of class for better spread operator support
 */
export interface Download {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  format: string;
  audioOnly: boolean;
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  filePath: string;
  fileSize: number;
  errorMessage: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * DownloadStatus representa o estado de um download no backend
 * Matches storage.DownloadStatus in Go
 */
export type DownloadStatus =
  | "pending"
  | "downloading"
  | "merging"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * DownloadProgress - payload do evento download:progress
 */
export interface DownloadProgress {
  id: string;
  status: DownloadStatus;
  progress: number;
  speed: string;
  eta: string;
  title?: string;
  thumbnail?: string;
}

/**
 * DownloadState - Estado gerenciado pelo Zustand
 */
interface DownloadState {
  queue: Download[];
  history: Download[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setQueue: (downloads: Download[]) => void;
  setHistory: (downloads: Download[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateDownload: (id: string, updates: Partial<Download>) => void;
  addDownload: (download: Download) => void;
  completeDownload: (id: string) => void;
  removeFromQueue: (id: string) => void;
}

export const useDownloadStore = create<DownloadState>((set) => ({
  queue: [],
  history: [],
  isLoading: false,
  error: null,

  setQueue: (downloads) => set({ queue: downloads }),

  setHistory: (downloads) => set({ history: downloads }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  updateDownload: (id, updates) =>
    set((state) => ({
      queue: state.queue.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),

  addDownload: (download) =>
    set((state) => {
      // Evitar duplicidade na fila
      const alreadyInQueue = state.queue.some((d) => d.id === download.id);
      if (alreadyInQueue) {
        return state; // Não adicionar se já existe
      }
      return {
        queue: [...state.queue, download],
      };
    }),

  completeDownload: (id) =>
    set((state) => {
      const download = state.queue.find((d) => d.id === id);
      if (!download) return state;

      // Evitar duplicidade no histórico
      const alreadyInHistory = state.history.some((h) => h.id === id);
      if (alreadyInHistory) {
        return {
          queue: state.queue.filter((d) => d.id !== id),
        };
      }

      return {
        queue: state.queue.filter((d) => d.id !== id),
        history: [download, ...state.history],
      };
    }),

  removeFromQueue: (id) =>
    set((state) => ({
      queue: state.queue.filter((d) => d.id !== id),
    })),
}));
