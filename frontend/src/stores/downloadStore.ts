import { create } from "zustand";

// Types
interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  view_count: number;
}

interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
  status:
    | "idle"
    | "fetching"
    | "downloading"
    | "merging"
    | "complete"
    | "error";
  filename: string;
}

interface DownloadItem {
  id: string;
  url: string;
  info: VideoInfo | null;
  progress: DownloadProgress;
  format: string;
  audioOnly: boolean;
  createdAt: number;
}

interface DownloadState {
  queue: DownloadItem[];
  currentId: string | null;

  // Actions
  addToQueue: (url: string, format?: string, audioOnly?: boolean) => string;
  updateInfo: (id: string, info: VideoInfo) => void;
  updateProgress: (id: string, progress: Partial<DownloadProgress>) => void;
  removeFromQueue: (id: string) => void;
  setCurrentId: (id: string | null) => void;
  clearCompleted: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useDownloadStore = create<DownloadState>((set) => ({
  queue: [],
  currentId: null,

  addToQueue: (url, format = "best", audioOnly = false) => {
    const id = generateId();
    set((state) => ({
      queue: [
        ...state.queue,
        {
          id,
          url,
          info: null,
          progress: {
            percent: 0,
            speed: "",
            eta: "",
            status: "idle",
            filename: "",
          },
          format,
          audioOnly,
          createdAt: Date.now(),
        },
      ],
    }));
    return id;
  },

  updateInfo: (id, info) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id ? { ...item, info } : item
      ),
    })),

  updateProgress: (id, progress) =>
    set((state) => ({
      queue: state.queue.map((item) =>
        item.id === id
          ? { ...item, progress: { ...item.progress, ...progress } }
          : item
      ),
    })),

  removeFromQueue: (id) =>
    set((state) => ({
      queue: state.queue.filter((item) => item.id !== id),
    })),

  setCurrentId: (id) => set({ currentId: id }),

  clearCompleted: () =>
    set((state) => ({
      queue: state.queue.filter((item) => item.progress.status !== "complete"),
    })),
}));
