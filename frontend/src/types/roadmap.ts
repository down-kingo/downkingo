/**
 * Roadmap Types
 *
 * Defines the TypeScript interfaces for the roadmap feature,
 * aligned with the Go backend contract.
 */

export type RoadmapStatus = "idea" | "planned" | "in-progress" | "shipped";

/**
 * RoadmapItem represents a single feature/issue in the roadmap
 */
export interface RoadmapItem {
  id: number;
  title: string;
  /** AI-processed user-friendly title (optional) */
  friendly_title?: string;
  /** Description (may contain markdown, max 150 chars) */
  description: string;
  status: RoadmapStatus;
  /** Total upvotes (backwards compatible) */
  votes: number;
  /** Upvotes count from CDN */
  votes_up?: number;
  /** Downvotes count from CDN */
  votes_down?: number;
  comments: number;
  url: string;
  labels: string[];
  author: string;
  author_avatar: string;
  /** ISO date string (YYYY-MM-DD) */
  created_at: string;
  /** ISO date string when shipped (optional) */
  shipped_at?: string;
}

/**
 * CDN Roadmap Response
 */
export interface CDNRoadmap {
  version: string;
  generated_at: string;
  source: {
    owner: string;
    repo: string;
    project_number: number;
  };
  items: RoadmapItem[];
}

/**
 * CDN Metadata Response (lightweight check)
 */
export interface CDNMeta {
  version: string;
  generated_at: string;
  items_count: number;
  content_hash: string;
}

/**
 * Column configuration for the Kanban board
 */
export interface RoadmapColumn {
  id: RoadmapStatus;
  label: string;
  sub: string;
  accent: string;
  glow: string;
  text: string;
  bg: string;
}
