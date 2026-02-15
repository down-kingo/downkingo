/**
 * Roadmap Store
 *
 * Zustand store for roadmap state management with
 * real-time updates via Wails events.
 */

import React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RoadmapItem, RoadmapStatus } from "../types/roadmap";

// Wails v3 runtime imports
import { Events } from "@wailsio/runtime";
import {
  GetRoadmap,
  VoteFeature,
  VoteDownFeature,
} from "../../bindings/kingo/app";

// User vote state: 'up', 'down', or null (no vote)
type UserVote = "up" | "down" | null;

interface RoadmapState {
  // Data
  items: RoadmapItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  currentLang: string;
  // Track user's votes per item ID
  userVotes: Record<number, UserVote>;

  // Actions
  fetchRoadmap: (lang?: string) => Promise<void>;
  setItems: (items: RoadmapItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Voting actions
  voteForItem: (id: number) => Promise<void>;
  voteDownForItem: (id: number) => Promise<void>;

  // Sync user's votes from backend
  syncUserVotes: () => Promise<void>;

  // Get user's current vote for an item
  getUserVote: (id: number) => UserVote;

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
      currentLang: "pt-BR",
      userVotes: {}, // Track user's votes: { itemId: 'up' | 'down' | null }

      // Fetch roadmap from backend
      fetchRoadmap: async (lang: string = "pt-BR") => {
        const { items, currentLang } = get();
        const isLangChange = lang !== currentLang;

        if (items.length === 0 || isLangChange) {
          set({ isLoading: true, currentLang: lang });
        }

        try {
          const data = await GetRoadmap(lang);
          if (data && Array.isArray(data)) {
            const freshItems = data.map((item) => ({
              ...item,
            })) as RoadmapItem[];

            set({
              items: freshItems,
              isLoading: false,
              error: null,
              lastUpdated: Date.now(),
              currentLang: lang,
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

      setItems: (items) => {
        set({ items, lastUpdated: Date.now(), error: null });
      },

      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),

      // Get user's current vote for an item
      getUserVote: (id) => {
        return get().userVotes[id] || null;
      },

      // Sync user votes from backend
      syncUserVotes: async () => {
        try {
          // Dynamic import to avoid breaking if binding doesn't exist yet
          const { GetUserReactions } = await import("../../bindings/kingo/app");
          if (typeof GetUserReactions !== "function") {
            return;
          }
          const reactions = await GetUserReactions();
          if (reactions) {
            // Convert GitHub reaction format to our format
            // +1 -> up, -1 -> down
            const userVotes: Record<number, UserVote> = {};
            for (const [idStr, reaction] of Object.entries(reactions)) {
              const id = parseInt(idStr, 10);
              if (reaction === "+1") {
                userVotes[id] = "up";
              } else if (reaction === "-1") {
                userVotes[id] = "down";
              }
            }
            set({ userVotes });
          }
        } catch (err) {
          console.warn(
            "[RoadmapStore] Failed to sync user votes (binding may not exist yet):",
            err,
          );
        }
      },

      /**
       * Vote UP for an item.
       * Only updates button state (userVotes) optimistically.
       * Actual vote counts are updated by the server via background sync
       * to prevent double-counting (server totals already include the user's vote).
       */
      voteForItem: async (id) => {
        const { userVotes } = get();
        const currentVote = userVotes[id] || null;

        // Already voted up - do nothing
        if (currentVote === "up") {
          return;
        }

        const originalUserVotes = { ...userVotes };

        // Optimistic: only update button highlight, NOT counts
        set({
          userVotes: { ...userVotes, [id]: "up" },
        });

        try {
          await VoteFeature(id);
        } catch (err) {
          console.error("Vote failed:", err);
          // Rollback button state on failure
          set({ userVotes: originalUserVotes });
          throw err;
        }
      },

      /**
       * Vote DOWN for an item.
       * Only updates button state (userVotes) optimistically.
       * Actual vote counts are updated by the server via background sync.
       */
      voteDownForItem: async (id) => {
        const { userVotes } = get();
        const currentVote = userVotes[id] || null;

        // Already voted down - do nothing
        if (currentVote === "down") {
          return;
        }

        const originalUserVotes = { ...userVotes };

        // Optimistic: only update button highlight, NOT counts
        set({
          userVotes: { ...userVotes, [id]: "down" },
        });

        try {
          await VoteDownFeature(id);
        } catch (err) {
          console.error("Vote down failed:", err);
          // Rollback button state on failure
          set({ userVotes: originalUserVotes });
          throw err;
        }
      },

      // Get items filtered by status
      getItemsByStatus: (status) => {
        return get().items.filter((item) => item.status === status);
      },

      // Subscribe to real-time updates from backend
      subscribeToUpdates: () => {
        // Full roadmap update (from CDN sync)
        const handleFullUpdate = (newItems: RoadmapItem[]) => {
          if (newItems && Array.isArray(newItems)) {
            const freshItems = newItems.map(item => ({ ...item }));
            set({
              items: freshItems,
              lastUpdated: Date.now(),
              error: null,
              isLoading: false,
            });
          }
        };

        // Targeted vote count update (from GitHub API, bypasses CDN)
        const handleVoteUpdate = (data: { id: number; votes_up: number; votes_down: number }) => {
          if (!data || !data.id) return;
          const { items } = get();
          const updatedItems = items.map(item => {
            if (item.id !== data.id) return item;
            return {
              ...item,
              votes_up: data.votes_up,
              votes_down: data.votes_down,
              votes: data.votes_up,
            };
          });
          set({ items: updatedItems, lastUpdated: Date.now() });
        };

        const cancelFullUpdate = Events.On(
          "roadmap:update",
          (event: { data: RoadmapItem[] }) => {
            handleFullUpdate(event.data);
          },
        );

        const cancelVoteUpdate = Events.On(
          "roadmap:vote-update",
          (event: { data: { id: number; votes_up: number; votes_down: number } }) => {
            handleVoteUpdate(event.data);
          },
        );

        return () => {
          cancelFullUpdate();
          cancelVoteUpdate();
        };
      },
    }),
    {
      name: "roadmap-storage",
      // Persist items, lastUpdated, and userVotes
      partialize: (state) => ({
        items: state.items,
        lastUpdated: state.lastUpdated,
        userVotes: state.userVotes, // Save user's votes locally
      }),
    },
  ),
);

/**
 * Hook to initialize roadmap with event subscription
 * Use in a top-level component (e.g., Roadmap page)
 */
export function useRoadmapInit() {
  const fetchRoadmap = useRoadmapStore((state) => state.fetchRoadmap);
  const subscribeToUpdates = useRoadmapStore(
    (state) => state.subscribeToUpdates,
  );
  const syncUserVotes = useRoadmapStore((state) => state.syncUserVotes);
  const currentLang = useRoadmapStore((state) => state.currentLang);

  // Track if we've initialized to prevent double-fetch
  const hasInitialized = React.useRef(false);

  const initialize = React.useCallback(
    (lang: string = "pt-BR") => {
      // Prevent double initialization
      if (hasInitialized.current) {
        return () => {};
      }
      hasInitialized.current = true;

      // Fetch data for the specified language
      fetchRoadmap(lang);

      // Sync user's existing votes from GitHub
      syncUserVotes();

      // Subscribe to live updates
      const unsubscribe = subscribeToUpdates();

      return () => {
        hasInitialized.current = false;
        unsubscribe();
      };
    },
    [fetchRoadmap, subscribeToUpdates, syncUserVotes],
  );

  // Memoize refetch to prevent it from changing
  const refetch = React.useCallback(
    (lang: string) => fetchRoadmap(lang),
    [fetchRoadmap],
  );

  return {
    initialize,
    currentLang,
    refetch,
    syncUserVotes,
  };
}
