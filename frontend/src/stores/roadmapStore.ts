/**
 * Roadmap Store
 *
 * Zustand store for roadmap state management with
 * real-time updates via Wails events.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RoadmapItem, RoadmapStatus } from "../types/roadmap";

// Wails runtime imports
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import {
  GetRoadmap,
  VoteFeature,
  VoteDownFeature,
} from "../../wailsjs/go/main/App";

interface RoadmapState {
  // Data
  items: RoadmapItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;

  // Actions
  fetchRoadmap: (lang?: string) => Promise<void>;
  setItems: (items: RoadmapItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  voteForItem: (id: number) => Promise<void>;
  voteDownForItem: (id: number) => Promise<void>;
  getItemsByStatus: (status: RoadmapStatus) => RoadmapItem[];

  // Event handling
  subscribeToUpdates: () => () => void;
}

export const useRoadmapStore = create<RoadmapState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      isLoading: false,
      error: null,
      lastUpdated: null,

      // Fetch roadmap from backend
      fetchRoadmap: async (lang: string = "pt-BR") => {
        const { items } = get();

        // Only show loading if we have no cached data
        if (items.length === 0) {
          set({ isLoading: true });
        }

        try {
          // Pass current language to backend to fetch correct JSON
          const data = await GetRoadmap(lang);
          if (data && Array.isArray(data)) {
            set({
              items: data as RoadmapItem[],
              isLoading: false,
              error: null,
              lastUpdated: Date.now(),
            });
          }
        } catch (err) {
          console.error("Failed to fetch roadmap:", err);
          set({
            error:
              err instanceof Error ? err.message : "Falha ao carregar roadmap",
            isLoading: false,
          });
        }
      },

      // Update items (from backend event or API)
      setItems: (items) => {
        set({
          items,
          lastUpdated: Date.now(),
          error: null,
        });
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Optimistic vote with rollback on failure
      voteForItem: async (id) => {
        const { items } = get();
        const originalItems = [...items];

        // Optimistic update
        set({
          items: items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  votes: (item.votes || 0) + 1,
                  votes_up: (item.votes_up || 0) + 1,
                }
              : item
          ),
        });

        try {
          await VoteFeature(id);
        } catch (err) {
          console.error("Vote failed:", err);
          // Rollback on failure
          set({ items: originalItems });
          throw err;
        }
      },

      // Optimistic downvote with rollback on failure
      voteDownForItem: async (id) => {
        const { items } = get();
        const originalItems = [...items];

        // Optimistic update
        set({
          items: items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  votes: (item.votes || 0) + 1, // GitHub counts reactions as activity
                  votes_down: (item.votes_down || 0) + 1,
                }
              : item
          ),
        });

        try {
          await VoteDownFeature(id);
        } catch (err) {
          console.error("Vote down failed:", err);
          // Rollback on failure
          set({ items: originalItems });
          throw err;
        }
      },

      // Get items filtered by status
      getItemsByStatus: (status) => {
        return get().items.filter((item) => item.status === status);
      },

      // Subscribe to real-time updates from backend
      subscribeToUpdates: () => {
        const handleUpdate = (newItems: RoadmapItem[]) => {
          console.log(
            "[RoadmapStore] Received roadmap:update event",
            newItems?.length
          );
          if (newItems && Array.isArray(newItems)) {
            set({
              items: newItems,
              lastUpdated: Date.now(),
              error: null,
            });
          }
        };

        // Subscribe to roadmap:update events from Go backend
        EventsOn("roadmap:update", handleUpdate);

        // Return cleanup function
        return () => {
          EventsOff("roadmap:update");
        };
      },
    }),
    {
      name: "roadmap-storage",
      // Only persist items and lastUpdated
      partialize: (state) => ({
        items: state.items,
        lastUpdated: state.lastUpdated,
      }),
    }
  )
);

/**
 * Hook to initialize roadmap with event subscription
 * Use in a top-level component (e.g., Roadmap page)
 */
export function useRoadmapInit() {
  const { fetchRoadmap, subscribeToUpdates } = useRoadmapStore();

  return {
    initialize: (lang: string = "pt-BR") => {
      // Fetch initial data
      fetchRoadmap(lang);

      // Subscribe to live updates
      const unsubscribe = subscribeToUpdates();

      return unsubscribe;
    },
  };
}
