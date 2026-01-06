/**
 * Text Utilities
 *
 * Helpers for cleaning and transforming text content
 * from the roadmap items.
 */

import type { RoadmapItem } from "../types/roadmap";

/**
 * Technical prefix patterns to remove from titles
 * Matches: feat(scope): , fix(scope): , chore: , etc.
 */
const TECHNICAL_PREFIX_REGEX =
  /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\([^)]+\))?\s*:\s*/i;

/**
 * Markdown patterns to strip from descriptions
 */
const MARKDOWN_PATTERNS = [
  /^#{1,6}\s+/gm, // Headers: ## Title
  /\*\*([^*]+)\*\*/g, // Bold: **text**
  /\*([^*]+)\*/g, // Italic: *text*
  /__([^_]+)__/g, // Bold: __text__
  /_([^_]+)_/g, // Italic: _text_
  /`([^`]+)`/g, // Inline code: `code`
  /```[\s\S]*?```/g, // Code blocks
  /\[([^\]]+)\]\([^)]+\)/g, // Links: [text](url)
  /!\[([^\]]*)\]\([^)]+\)/g, // Images: ![alt](url)
  /^>\s+/gm, // Blockquotes: > text
  /^[-*+]\s+/gm, // Unordered lists
  /^\d+\.\s+/gm, // Ordered lists
  /^---+$/gm, // Horizontal rules
];

/**
 * Removes technical prefixes from issue titles
 *
 * @example
 * cleanTitle("feat(network): Share downloads") // "Share downloads"
 * cleanTitle("fix: Memory leak") // "Memory leak"
 * cleanTitle("Normal title") // "Normal title"
 */
export function cleanTitle(title: string): string {
  if (!title) return "";

  const cleaned = title.replace(TECHNICAL_PREFIX_REGEX, "").trim();

  // Capitalize first letter if it became lowercase
  if (cleaned.length > 0 && cleaned[0] === cleaned[0].toLowerCase()) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Removes markdown formatting from description text
 *
 * @example
 * cleanDescription("## Context\n**Bold** text") // "Context Bold text"
 */
export function cleanDescription(description: string): string {
  if (!description) return "";

  let cleaned = description;

  // Apply all markdown removal patterns
  for (const pattern of MARKDOWN_PATTERNS) {
    cleaned = cleaned.replace(pattern, (match, group1) => {
      // For patterns with capture groups (bold, italic, links), return the content
      return group1 !== undefined ? group1 : "";
    });
  }

  // Normalize whitespace
  cleaned = cleaned
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();

  return cleaned;
}

/**
 * Gets the display title for a roadmap item,
 * preferring friendly_title over cleaned title
 *
 * @example
 * getDisplayTitle({ friendly_title: "Easy sharing", title: "feat: share" }) // "Easy sharing"
 * getDisplayTitle({ title: "feat: share" }) // "Share"
 */
export function getDisplayTitle(item: RoadmapItem): string {
  if (item.friendly_title && item.friendly_title.trim().length > 0) {
    return item.friendly_title;
  }
  return cleanTitle(item.title);
}

/**
 * Gets the display description with markdown removed
 */
export function getDisplayDescription(item: RoadmapItem): string {
  return cleanDescription(item.description);
}

/**
 * Formats vote counts for display
 *
 * @example
 * formatVotes(15, 2) // "👍 15 👎 2"
 * formatVotes(15) // "👍 15"
 */
export function formatVotes(votesUp: number, votesDown?: number): string {
  if (votesDown !== undefined && votesDown > 0) {
    return `👍 ${votesUp} 👎 ${votesDown}`;
  }
  return `👍 ${votesUp}`;
}

/**
 * Truncates text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number = 150): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Gets a status badge configuration
 */
export function getStatusConfig(status: string): {
  label: string;
  color: string;
  bg: string;
} {
  const configs: Record<string, { label: string; color: string; bg: string }> =
    {
      idea: {
        label: "Bastidores",
        color: "text-yellow-500",
        bg: "bg-yellow-500/10",
      },
      planned: {
        label: "Em Pauta",
        color: "text-blue-500",
        bg: "bg-blue-500/10",
      },
      "in-progress": {
        label: "Em Produção",
        color: "text-purple-500",
        bg: "bg-purple-500/10",
      },
      shipped: {
        label: "No Ar",
        color: "text-green-500",
        bg: "bg-green-500/10",
      },
    };

  return configs[status] || configs.idea;
}
