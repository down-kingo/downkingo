import { memo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  IconBrandGithub,
  IconThumbUp,
  IconThumbDown,
} from "@tabler/icons-react";
import type { RoadmapItem } from "../../types/roadmap";
import type { ColumnConfig } from "./types";

// User vote state type
type UserVote = "up" | "down" | null;

interface RoadmapCardProps {
  item: RoadmapItem;
  column: ColumnConfig;
  index: number;
  isAuthenticated: boolean;
  userVote: UserVote; // Current user's vote on this item
  onVote: (id: number) => void;
  onVoteDown: (id: number) => void;
  onClick: () => void;
}

// Custom comparison function to properly detect vote changes
function arePropsEqual(
  prev: RoadmapCardProps,
  next: RoadmapCardProps,
): boolean {
  return (
    prev.item.id === next.item.id &&
    prev.item.votes_up === next.item.votes_up &&
    prev.item.votes_down === next.item.votes_down &&
    prev.item.votes === next.item.votes &&
    prev.item.title === next.item.title &&
    prev.item.status === next.item.status &&
    prev.column.id === next.column.id &&
    prev.index === next.index &&
    prev.isAuthenticated === next.isAuthenticated &&
    prev.userVote === next.userVote
  );
}

export const RoadmapCard = memo(function RoadmapCard({
  item,
  column,
  index,
  isAuthenticated,
  userVote,
  onVote,
  onVoteDown,
  onClick,
}: RoadmapCardProps) {
  const { t, i18n } = useTranslation("roadmap");

  const cleanTitle = (text: string) =>
    text.replace(
      /^(feat|fix|chore|docs|refactor|style|test|ci)\([^)]*\):\s*/i,
      "",
    );

  const displayTitle =
    item.title_i18n?.[i18n.language] ||
    item.title_i18n?.["en-US"] ||
    item.friendly_title ||
    cleanTitle(item.title);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        type: "spring",
        bounce: 0,
        delay: index * 0.05,
      }}
      className={`group relative 
        bg-white dark:bg-surface-100
        border border-surface-200 dark:border-white/10
        p-0 rounded-xl 
        shadow-sm hover:shadow-lg
        transition-all duration-300 
        overflow-hidden
        cursor-pointer active:scale-[0.99]
      `}
      onClick={onClick}
    >
      <div
        className={`absolute top-0 left-0 w-[4px] h-full bg-current ${column.text} opacity-40`}
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Topo: ID */}
        <div className="px-4 pt-4">
          <span className="text-[10px] font-mono font-medium text-surface-400">
            ID: #{item.id}
          </span>
        </div>

        {/* Corpo: Título + Labels */}
        <div className="px-4 pt-1 pb-4 flex-1">
          <h4
            className="text-base font-bold text-surface-900 dark:text-white leading-tight mb-3"
            title={item.title}
          >
            {displayTitle}
          </h4>

          <div className="flex flex-wrap gap-1.5">
            {(item.labels || []).slice(0, 3).map((l, i) => {
              const colors = [
                "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
                "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
                "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300",
              ];
              const style = colors[i % colors.length];

              return (
                <span
                  key={l}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${style}`}
                >
                  {l}
                </span>
              );
            })}
          </div>
        </div>

        <div className="h-[1px] bg-surface-100 dark:bg-white/5 w-full" />

        {/* Footer: Link e Votos */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors group/link"
              onClick={(e) => e.stopPropagation()}
            >
              <IconBrandGithub size={16} stroke={1.5} />
              <span className="text-xs font-bold uppercase tracking-wider group-hover/link:underline">
                {t("card.url")}
              </span>
            </a>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-3">
            {/* Upvote button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isAuthenticated && userVote !== "up") {
                  onVote(item.id);
                }
              }}
              disabled={!isAuthenticated || userVote === "up"}
              className={`flex items-center gap-1 group/up focus:outline-none transition-opacity ${
                userVote === "up"
                  ? "opacity-100"
                  : "opacity-70 hover:opacity-100"
              } ${!isAuthenticated || userVote === "up" ? "cursor-default" : "cursor-pointer"}`}
              title={userVote === "up" ? t("card.voted") : t("card.like")}
            >
              <IconThumbUp
                size={16}
                stroke={2}
                className={`transition-colors ${
                  userVote === "up"
                    ? "text-green-600 fill-green-200 dark:fill-green-900/50"
                    : "text-surface-400 group-hover/up:text-green-600"
                }`}
              />
              <span
                className={`text-xs font-bold ${
                  userVote === "up"
                    ? "text-green-700 dark:text-green-400"
                    : "text-surface-500"
                }`}
              >
                {item.votes_up || 0}
              </span>
            </button>

            {/* Downvote button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isAuthenticated && userVote !== "down") {
                  onVoteDown(item.id);
                }
              }}
              disabled={!isAuthenticated || userVote === "down"}
              className={`flex items-center gap-1 group/down focus:outline-none transition-opacity ${
                userVote === "down"
                  ? "opacity-100"
                  : "opacity-70 hover:opacity-100"
              } ${!isAuthenticated || userVote === "down" ? "cursor-default" : "cursor-pointer"}`}
              title={userVote === "down" ? t("card.voted") : t("card.dislike")}
            >
              <IconThumbDown
                size={16}
                stroke={2}
                className={`transition-colors ${
                  userVote === "down"
                    ? "text-red-600 fill-red-200 dark:fill-red-900/50"
                    : "text-surface-400 group-hover/down:text-red-600"
                }`}
              />
              <span
                className={`text-xs font-bold ${
                  userVote === "down"
                    ? "text-red-700 dark:text-red-400"
                    : "text-surface-500"
                }`}
              >
                {item.votes_down || 0}
              </span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}, arePropsEqual);
