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
          console.log(
            "[RoadmapStore] fetchRoadmap received data:",
            data?.length,
            "items",
          );

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
            console.log("[RoadmapStore] GetUserReactions not available yet");
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
            console.log("[RoadmapStore] Synced user votes:", userVotes);
          }
        } catch (err) {
          console.warn(
            "[RoadmapStore] Failed to sync user votes (binding may not exist yet):",
            err,
          );
        }
      },

      /**
       * Vote UP for an item with exclusive logic:
       * - If no vote: add up vote
       * - If already up: do nothing (already voted)
       * - If down: switch to up (decrement down, increment up)
       */
      voteForItem: async (id) => {
        const { items, userVotes } = get();
        const currentVote = userVotes[id] || null;

        // Already voted up - do nothing
        if (currentVote === "up") {
          console.log("[RoadmapStore] Already voted up, ignoring");
          return;
        }

        const originalItems = [...items];
        const originalUserVotes = { ...userVotes };

        // Calculate optimistic update
        const updatedItems = items.map((item) => {
          if (item.id !== id) return { ...item };

          const newItem = { ...item };

          // If switching from down to up
          if (currentVote === "down") {
            newItem.votes_down = Math.max(0, (newItem.votes_down || 0) - 1);
          }

          // Add up vote
          newItem.votes_up = (newItem.votes_up || 0) + 1;
          newItem.votes = newItem.votes_up;

          return newItem;
        });

        // Update state optimistically
        set({
          items: updatedItems,
          userVotes: { ...userVotes, [id]: "up" },
          lastUpdated: Date.now(),
        });

        try {
          await VoteFeature(id);
          console.log("[RoadmapStore] Vote up successful");
        } catch (err) {
          console.error("Vote failed:", err);
          // Rollback on failure
          set({ items: originalItems, userVotes: originalUserVotes });
          throw err;
        }
      },

      /**
       * Vote DOWN for an item with exclusive logic:
       * - If no vote: add down vote
       * - If already down: do nothing (already voted)
       * - If up: switch to down (decrement up, increment down)
       */
      voteDownForItem: async (id) => {
        const { items, userVotes } = get();
        const currentVote = userVotes[id] || null;

        // Already voted down - do nothing
        if (currentVote === "down") {
          console.log("[RoadmapStore] Already voted down, ignoring");
          return;
        }

        const originalItems = [...items];
        const originalUserVotes = { ...userVotes };

        // Calculate optimistic update
        const updatedItems = items.map((item) => {
          if (item.id !== id) return { ...item };

          const newItem = { ...item };

          // If switching from up to down
          if (currentVote === "up") {
            newItem.votes_up = Math.max(0, (newItem.votes_up || 0) - 1);
            newItem.votes = newItem.votes_up;
          }

          // Add down vote
          newItem.votes_down = (newItem.votes_down || 0) + 1;

          return newItem;
        });

        // Update state optimistically
        set({
          items: updatedItems,
          userVotes: { ...userVotes, [id]: "down" },
          lastUpdated: Date.now(),
        });

        try {
          await VoteDownFeature(id);
          console.log("[RoadmapStore] Vote down successful");
        } catch (err) {
          console.error("Vote down failed:", err);
          // Rollback on failure
          set({ items: originalItems, userVotes: originalUserVotes });
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
            "items count:",
            newItems?.length,
          );

          if (newItems && Array.isArray(newItems)) {
            // Log first item votes for debugging
            if (newItems.length > 0) {
              const first = newItems[0];
              console.log(
                "[RoadmapStore] First item votes:",
                first.id,
                "up:",
                first.votes_up,
                "down:",
                first.votes_down,
              );
            }

            // Create new references to ensure React re-renders
            const freshItems = newItems.map((item) => ({ ...item }));

            set({
              items: freshItems,
              lastUpdated: Date.now(),
              error: null,
              isLoading: false,
            });

            console.log("[RoadmapStore] State updated with fresh items");
          }
        };

        // Subscribe to roadmap:update events from Go backend
        // Wails v3: Events.On callback receives a WailsEvent wrapper with { data }
        const cancel = Events.On(
          "roadmap:update",
          (event: { data: RoadmapItem[] }) => {
            console.log("[RoadmapStore] Raw event received:", event);
            handleUpdate(event.data);
          },
        );

        // Return cleanup function
        return () => {
          cancel();
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
