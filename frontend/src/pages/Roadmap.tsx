import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconBulb,
  IconBrandGithub,
  IconThumbUp,
  IconThumbDown,
  IconArrowRight,
  IconArrowLeft,
  IconExternalLink,
  IconPlus,
  IconLoader2,
  IconCopy,
  IconActivity,
  IconBroadcast,
  IconPlayerTrackNext,
} from "@tabler/icons-react";
import SuggestionModal from "../components/SuggestionModal";

// Store & Utils
import { useRoadmapStore, useRoadmapInit } from "../stores/roadmapStore";
import { useShallow } from "zustand/react/shallow";
import { getDisplayTitle, getDisplayDescription } from "../utils/textUtils";
import type { RoadmapItem, RoadmapStatus } from "../types/roadmap";
import { RoadmapCard } from "../components/roadmap/RoadmapCard";
import type { ColumnConfig } from "../components/roadmap/types";

// Backend functions
import {
  StartGitHubAuth,
  PollGitHubAuth,
  GetGitHubToken,
  SuggestFeature,
  OpenUrl,
  LogoutGitHub,
} from "../../bindings/kingo/app";

// Tipo para configuração de coluna

const getColumns = (t: (key: string) => string): ColumnConfig[] => [
  {
    id: "idea" as RoadmapStatus,
    label: t("columns.idea.label"),
    sub: t("columns.idea.sub"),
    icon: IconBulb,
    accent: "border-yellow-500/50",
    glow: "group-hover:shadow-yellow-500/20",
    text: "text-yellow-500",
    bg: "bg-yellow-500/5",
    glass:
      "bg-yellow-500/5 dark:bg-yellow-500/5 border-yellow-500/20 hover:border-yellow-500/50 hover:bg-yellow-500/10 shadow-yellow-500/5",
    barColor: "bg-yellow-500",
  },
  {
    id: "planned" as RoadmapStatus,
    label: t("columns.planned.label"),
    sub: t("columns.planned.sub"),
    icon: IconPlayerTrackNext,
    accent: "border-blue-500/50",
    glow: "group-hover:shadow-blue-500/20",
    text: "text-blue-500",
    bg: "bg-blue-500/5",
    glass:
      "bg-blue-500/5 dark:bg-blue-500/5 border-blue-500/20 hover:border-blue-500/50 hover:bg-blue-500/10 shadow-blue-500/5",
    barColor: "bg-blue-500",
  },
  {
    id: "in-progress" as RoadmapStatus,
    label: t("columns.in_progress.label"),
    sub: t("columns.in_progress.sub"),
    icon: IconActivity,
    accent: "border-purple-500/50",
    glow: "group-hover:shadow-purple-500/20",
    text: "text-purple-500",
    bg: "bg-purple-500/5",
    glass:
      "bg-purple-500/5 dark:bg-purple-500/5 border-purple-500/20 hover:border-purple-500/50 hover:bg-purple-500/10 shadow-purple-500/5",
    barColor: "bg-purple-500",
  },
  {
    id: "shipped" as RoadmapStatus,
    label: t("columns.shipped.label"),
    sub: t("columns.shipped.sub"),
    icon: IconBroadcast,
    accent: "border-green-500/50",
    glow: "group-hover:shadow-green-500/20",
    text: "text-green-500",
    bg: "bg-green-500/5",
    glass:
      "bg-green-500/5 dark:bg-green-500/5 border-green-500/20 hover:border-green-500/50 hover:bg-green-500/10 shadow-green-500/5",
    barColor: "bg-green-500",
  },
];

export default function Roadmap() {
  const { t, i18n } = useTranslation("roadmap");
  const COLUMNS = getColumns(t);

  // Store state - don't include lastUpdated in selector to avoid infinite loop
  const {
    items,
    isLoading,
    userVotes,
    fetchRoadmap,
    voteForItem,
    voteDownForItem,
    getUserVote,
  } = useRoadmapStore(
    useShallow((state) => ({
      items: state.items,
      isLoading: state.isLoading,
      userVotes: state.userVotes,
      fetchRoadmap: state.fetchRoadmap,
      voteForItem: state.voteForItem,
      voteDownForItem: state.voteDownForItem,
      getUserVote: state.getUserVote,
    })),
  );

  // Helper to filter items by status - runs during render, not as selector
  const getItemsByStatus = (status: RoadmapStatus) =>
    items.filter((item) => item.status === status);

  const { initialize, refetch, syncUserVotes } = useRoadmapInit();

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authData, setAuthData] = useState<{
    user_code: string;
    verification_uri: string;
    device_code: string;
  } | null>(null);
  const [isPollingAuth, setIsPollingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Detalhes View State
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const selectedItem = items.find((i) => i.id === selectedItemId);

  // Suggestion State
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Initial setup with subscription
    const cleanup = initialize(i18n.language);
    checkAuth();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // React to language changes specifically (skip initial render)
  const prevLang = useRef(i18n.language);
  useEffect(() => {
    if (prevLang.current !== i18n.language) {
      prevLang.current = i18n.language;
      refetch(i18n.language);
    }
  }, [i18n.language, refetch]);

  const checkAuth = async () => {
    const token = await GetGitHubToken();
    setIsAuthenticated(!!token && token.length > 0);
  };

  // --- Auth Flow (Device Flow) ---

  const startLogin = async () => {
    setIsAuthModalOpen(true);
    setAuthError(null);
    setAuthData(null);

    try {
      const data = await StartGitHubAuth();
      if (data && data.user_code) {
        setAuthData({
          user_code: data.user_code,
          verification_uri: data.verification_uri,
          device_code: data.device_code,
        });
        // Start polling in background
        pollForToken(data.device_code);
      } else {
        setAuthError(t("auth.invalid_response"));
      }
    } catch (err: unknown) {
      console.error("Auth failed", err);
      setAuthError(err instanceof Error ? err.message : t("auth.auth_failed"));
    }
  };

  const pollForToken = async (deviceCode: string) => {
    setIsPollingAuth(true);
    try {
      const token = await PollGitHubAuth(deviceCode);
      if (token) {
        setIsAuthenticated(true);
        setIsAuthModalOpen(false);
        setAuthData(null);
        // Sync user's votes from GitHub after login
        syncUserVotes();
      }
    } catch (err: unknown) {
      console.error("Auth poll failed", err);
      setAuthError(err instanceof Error ? err.message : t("auth.timeout"));
    } finally {
      setIsPollingAuth(false);
    }
  };

  const handleLogout = async () => {
    await LogoutGitHub();
    setIsAuthenticated(false);
  };

  // --- Actions ---

  const handleVote = async (id: number) => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }

    try {
      await voteForItem(id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("session expired") ||
        msg.includes("authentication required")
      ) {
        setIsAuthenticated(false);
        startLogin();
      }
      console.error("Vote failed", err);
    }
  };

  const handleVoteDown = async (id: number) => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }

    try {
      await voteDownForItem(id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("session expired") ||
        msg.includes("authentication required")
      ) {
        setIsAuthenticated(false);
        startLogin();
      }
      console.error("Vote down failed", err);
    }
  };

  const handleSuggestionClick = () => {
    if (!isAuthenticated) {
      startLogin();
      return;
    }
    setIsModalOpen(true);
  };

  const handleSubmitSuggestion = async (title: string, body: string) => {
    await SuggestFeature(title, body);
    fetchRoadmap(); // Refresh to show new issue
  };

  return (
    <div className="flex flex-col h-full bg-surface-50 dark:bg-surface-50 font-sans overflow-hidden">
      {/* Header */}
      <header className="px-8 py-6 flex items-end justify-between border-b border-surface-200 dark:border-white/10 bg-white dark:bg-surface-50 shrink-0 z-10 sticky top-0">
        <div>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 mb-1.5"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-surface-500">
              {t("live")}
            </span>
          </motion.div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight bg-gradient-to-r from-surface-900 to-surface-500 bg-clip-text text-transparent dark:from-white dark:to-white/60">
            {t("title")}
          </h1>
        </div>

        <div className="flex gap-3">
          {!isAuthenticated ? (
            <button
              onClick={startLogin}
              className="btn btn-ghost text-xs flex items-center gap-2"
            >
              <IconBrandGithub size={16} />
              {t("auth.connect_github")}
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="btn btn-ghost text-xs text-red-500 hover:text-red-600"
            >
              {t("auth.logout")}
            </button>
          )}

          <button
            onClick={handleSuggestionClick}
            className="group relative overflow-hidden px-5 py-2 rounded-lg bg-surface-900 dark:bg-primary-600 text-white dark:text-white shadow-lg shadow-surface-900/20 dark:shadow-primary-500/20 hover:shadow-surface-900/30 transition-all active:scale-95"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
            <div className="flex items-center gap-2 relative z-10 text-xs font-bold">
              <IconPlus size={14} stroke={3} />
              <span>{t("suggestion.new")}</span>
            </div>
          </button>
        </div>
      </header>

      {/* Kanban Grid & Details View Container */}
      <div className="flex-1 p-6 overflow-hidden relative min-h-0">
        <div className="grid grid-cols-4 gap-6 h-full w-full max-w-[1920px] mx-auto min-h-0">
          {COLUMNS.map((col) => {
            const colItems = getItemsByStatus(col.id);
            const Icon = col.icon;

            return (
              <div
                key={col.id}
                className="flex flex-col h-full min-h-0 min-w-0 group/col relative bg-surface-50/50 dark:bg-white/5 rounded-2xl border border-surface-200/50 dark:border-white/5 p-2"
              >
                <div className="flex items-center justify-between mb-4 px-3 pt-3 shrink-0">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg bg-surface-100 dark:bg-black/20 ${col.text} ${col.bg} border border-transparent dark:border-white/5`}
                    >
                      <Icon size={18} stroke={2} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-surface-700 dark:text-white leading-none">
                        {col.label}
                      </h3>
                      <span className="text-[10px] font-medium text-surface-400 dark:text-surface-300">
                        {col.sub}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-surface-400 bg-surface-200/50 dark:bg-white/5 px-2 py-0.5 rounded-full">
                    {colItems.length}
                  </span>
                </div>

                <div
                  className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-3 relative pb-2 min-h-0"
                  data-lenis-prevent
                  onWheel={(e) => e.stopPropagation()}
                >
                  {isLoading && items.length === 0 ? (
                    [1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-28 rounded-xl bg-surface-200/50 dark:bg-white/5 animate-pulse"
                      />
                    ))
                  ) : colItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 select-none py-10">
                      <div className={`p-4 rounded-full ${col.bg} mb-3`}>
                        <Icon size={32} className={col.text} stroke={1.5} />
                      </div>
                      <span className="text-xs font-medium text-surface-500">
                        {t("empty")}
                      </span>
                    </div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {colItems.map((item, index) => (
                        <RoadmapCard
                          key={item.id}
                          item={item}
                          column={col}
                          index={index}
                          isAuthenticated={isAuthenticated}
                          userVote={getUserVote(item.id)}
                          onVote={handleVote}
                          onVoteDown={handleVoteDown}
                          onClick={() => setSelectedItemId(item.id)}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Details View Overlay */}
        <AnimatePresence>
          {selectedItem && (
            <RoadmapDetail
              item={selectedItem}
              onClose={() => setSelectedItemId(null)}
              column={COLUMNS.find((c) => c.id === selectedItem.status)!}
              onVote={handleVote}
              onVoteDown={handleVoteDown}
              userVote={getUserVote(selectedItem.id)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Suggestion Modal */}
      <SuggestionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitSuggestion}
      />

      {/* Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <AuthModal
            authData={authData}
            authError={authError}
            isPollingAuth={isPollingAuth}
            onClose={() => setIsAuthModalOpen(false)}
            onRetry={startLogin}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Components ---

interface AuthModalProps {
  authData: {
    user_code: string;
    verification_uri: string;
    device_code: string;
  } | null;
  authError: string | null;
  isPollingAuth: boolean;
  onClose: () => void;
  onRetry: () => void;
}

function AuthModal({
  authData,
  authError,
  isPollingAuth,
  onClose,
  onRetry,
}: AuthModalProps) {
  const { t } = useTranslation("roadmap");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full max-w-sm bg-surface-900 text-white rounded-2xl p-8 border border-white/10 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl" />

        <div className="flex flex-col items-center text-center space-y-6 relative z-10">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-2">
            <IconBrandGithub size={32} />
          </div>

          <div>
            <h2 className="text-xl font-bold mb-2">{t("auth.title")}</h2>
            <p className="text-surface-400 text-sm">{t("auth.description")}</p>
          </div>

          {authData ? (
            <div className="w-full space-y-4 bg-black/30 p-4 rounded-xl border border-white/5">
              <div>
                <p className="text-xs text-surface-400 mb-1 uppercase tracking-wider">
                  {t("auth.your_code")}
                </p>
                <div className="flex items-center gap-2 justify-center">
                  <code className="text-2xl font-mono font-bold tracking-widest text-primary-400 select-all">
                    {authData.user_code}
                  </code>
                  <IconCopy
                    size={16}
                    className="text-surface-500 cursor-pointer hover:text-white"
                    onClick={() =>
                      navigator.clipboard.writeText(authData.user_code)
                    }
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(authData.user_code);
                    OpenUrl(authData.verification_uri);
                  }}
                  className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-surface-200 transition-colors flex items-center justify-center gap-2"
                >
                  <IconExternalLink size={16} />
                  {t("auth.copy_and_open")}
                </button>
              </div>

              {isPollingAuth && (
                <div className="flex items-center justify-center gap-2 text-xs text-surface-500 pt-2 animate-pulse">
                  <IconLoader2 size={12} className="animate-spin" />
                  {t("auth.waiting_auth")}
                </div>
              )}
            </div>
          ) : authError ? (
            <div className="w-full space-y-4 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
              <div className="text-center">
                <p className="text-sm text-red-400 font-medium mb-2">
                  {t("auth.error_title")}
                </p>
                <p className="text-xs text-surface-400 break-words">
                  {authError}
                </p>
              </div>
              <button
                onClick={onRetry}
                className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {t("auth.retry")}
              </button>
            </div>
          ) : (
            <div className="py-4 flex flex-col items-center">
              <IconLoader2
                size={32}
                className="animate-spin text-surface-500"
              />
              <p className="text-xs text-surface-500 mt-2">
                {t("auth.starting")}
              </p>
            </div>
          )}

          <button
            onClick={onClose}
            className="text-xs text-surface-500 hover:text-white mt-4"
          >
            {t("auth.cancel")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Detail View Component ---

function RoadmapDetail({
  item,
  onClose,
  column,
  onVote,
  onVoteDown,
  userVote,
}: {
  item: RoadmapItem;
  onClose: () => void;
  column: ColumnConfig;
  onVote: (id: number) => void;
  onVoteDown: (id: number) => void;
  userVote: "up" | "down" | null;
}) {
  const { t, i18n } = useTranslation("roadmap");
  const cleanTitle = (text: string) =>
    text.replace(
      /^(feat|fix|chore|docs|refactor|style|test|ci)\([^)]*\):\s*/i,
      "",
    );

  // Resolve localized title
  const displayTitle =
    item.title_i18n?.[i18n.language] ||
    item.title_i18n?.["en-US"] ||
    item.friendly_title || // String fallback
    cleanTitle(item.title);

  // Fecha ao pressionar ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
      className="absolute inset-0 z-50 bg-surface-50 dark:bg-surface-50 overflow-hidden text-surface-900 dark:text-surface-100"
    >
      {/* Botão Voltar - Lateral Esquerda Fixa */}
      <button
        onClick={onClose}
        className="absolute top-6 left-6 md:top-8 md:left-8 z-50 flex items-center gap-2 text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors group bg-transparent border-none cursor-pointer"
      >
        <IconArrowLeft
          size={20}
          className="group-hover:-translate-x-1 transition-transform"
        />
        <span className="text-sm font-medium">{t("detail.back")}</span>
      </button>

      {/* Área Scrollable - Ocupa tudo, scroll na borda direita */}
      <div
        className="h-full w-full overflow-y-auto custom-scrollbar"
        data-lenis-prevent
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Container Central */}
        <div className="max-w-3xl mx-auto px-6 md:px-12 pb-12 pt-20 md:pt-24 flex flex-col items-center text-center">
          {/* Header */}
          <div className="mb-8 md:mb-12 space-y-6 w-full flex flex-col items-center">
            <div className="flex justify-center items-center gap-3">
              <span className="px-3 py-1 bg-surface-100 dark:bg-white/5 rounded-full text-xs font-mono text-surface-500 border border-surface-200 dark:border-white/10">
                ID #{item.id}
              </span>
              {item.created_at && (
                <span className="text-xs font-mono text-surface-400">
                  {(() => {
                    try {
                      return new Date(item.created_at).toLocaleDateString(
                        i18n.language,
                      );
                    } catch {
                      return "";
                    }
                  })()}
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-5xl font-bold text-surface-900 dark:text-white leading-tight tracking-tight">
              {displayTitle}
            </h1>

            {/* Author Info */}
            <div className="flex items-center gap-2">
              {item.author_avatar && (
                <img
                  src={item.author_avatar}
                  alt={item.author}
                  className="w-6 h-6 rounded-full border border-white/10 shadow-sm"
                />
              )}
              <span className="text-sm font-medium text-surface-600 dark:text-surface-300">
                {item.author}
              </span>
            </div>

            {item.title !== displayTitle && (
              <span className="text-xs font-mono text-surface-400 select-all block opacity-60">
                {item.title}
              </span>
            )}
          </div>

          {/* Descrição Segura (React Markdown) */}
          <div className="max-w-3xl w-full text-left mx-auto">
            <ReactMarkdown
              disallowedElements={["img", "iframe", "script", "style", "html"]}
              unwrapDisallowed
              components={{
                // Headings com visual premium - cores da coluna
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-surface-900 dark:text-white mt-8 mb-4 pb-3 border-b border-surface-200 dark:border-white/10">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-bold text-surface-800 dark:text-white/90 mt-8 mb-3 flex items-center gap-3">
                    <span
                      className={`w-1 h-6 ${column.barColor} rounded-full`}
                    />
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-semibold text-surface-700 dark:text-white/90 mt-6 mb-2 flex items-center gap-2">
                    <span
                      className={`w-1 h-5 ${column.barColor} rounded-full opacity-80`}
                    />
                    {children}
                  </h3>
                ),
                // Parágrafos com espaçamento elegante
                p: ({ children }) => (
                  <p className="text-surface-600 dark:text-surface-200 leading-relaxed mb-4">
                    {children}
                  </p>
                ),
                // Listas estilizadas
                ul: ({ children }) => (
                  <ul className="space-y-2 my-4 ml-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="space-y-2 my-4 ml-1 list-decimal list-inside">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="flex items-start gap-3 text-surface-600 dark:text-surface-200">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    <span className="flex-1">{children}</span>
                  </li>
                ),
                // Inline code
                code: ({ children }) => (
                  <code className="px-1.5 py-0.5 rounded bg-surface-100 dark:bg-white/10 text-primary-600 dark:text-primary-400 font-mono text-sm">
                    {children}
                  </code>
                ),
                // Code blocks
                pre: ({ children }) => (
                  <pre className="p-4 rounded-xl bg-surface-900 dark:bg-black/50 text-surface-100 overflow-x-auto my-4 text-sm font-mono border border-surface-800">
                    {children}
                  </pre>
                ),
                // Bold
                strong: ({ children }) => (
                  <strong className="font-semibold text-surface-900 dark:text-white">
                    {children}
                  </strong>
                ),
                // Blockquotes
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary-500 pl-4 py-2 my-4 bg-primary-50 dark:bg-primary-900/10 rounded-r-lg italic text-surface-600 dark:text-surface-300">
                    {children}
                  </blockquote>
                ),
                // Links
                a: ({ node, ...props }) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 underline underline-offset-2 decoration-primary-500/30 hover:decoration-primary-500 transition-colors"
                  />
                ),
                // Horizontal rule
                hr: () => (
                  <hr className="my-8 border-t border-surface-200 dark:border-white/10" />
                ),
              }}
            >
              {item.description || t("detail.no_description")}
            </ReactMarkdown>
          </div>

          {/* Ações e Votação */}
          <div className="flex flex-col md:flex-row items-center justify-between w-full max-w-3xl mx-auto mt-12 mb-8 p-6 bg-surface-50 dark:bg-surface-100 rounded-2xl border border-surface-200 dark:border-white/10 gap-6">
            {/* Votação */}
            <div className="flex items-center gap-6">
              <button
                onClick={() => {
                  if (userVote !== "up") onVote(item.id);
                }}
                disabled={userVote === "up"}
                className={`flex items-center gap-2 transition-colors group ${
                  userVote === "up"
                    ? "text-green-600 cursor-default"
                    : "text-surface-600 dark:text-surface-300 hover:text-green-500 cursor-pointer"
                }`}
              >
                <div
                  className={`p-3 rounded-full transition-all ${
                    userVote === "up"
                      ? "bg-green-100 dark:bg-green-900/30 border-green-500/50"
                      : "bg-white dark:bg-white/5 border-surface-200 dark:border-white/10 group-hover:border-green-500/50 group-hover:bg-green-500/10"
                  } border`}
                >
                  <IconThumbUp
                    size={24}
                    className={`transition-transform ${userVote !== "up" ? "group-hover:scale-110" : ""}`}
                  />
                </div>
                <span className="font-bold text-lg">{item.votes_up || 0}</span>
              </button>

              <button
                onClick={() => {
                  if (userVote !== "down") onVoteDown(item.id);
                }}
                disabled={userVote === "down"}
                className={`flex items-center gap-2 transition-colors group ${
                  userVote === "down"
                    ? "text-red-600 cursor-default"
                    : "text-surface-600 dark:text-surface-300 hover:text-red-500 cursor-pointer"
                }`}
              >
                <div
                  className={`p-3 rounded-full transition-all ${
                    userVote === "down"
                      ? "bg-red-100 dark:bg-red-900/30 border-red-500/50"
                      : "bg-white dark:bg-white/5 border-surface-200 dark:border-white/10 group-hover:border-red-500/50 group-hover:bg-red-500/10"
                  } border`}
                >
                  <IconThumbDown
                    size={24}
                    className={`transition-transform ${userVote !== "down" ? "group-hover:scale-110" : ""}`}
                  />
                </div>
                <span className="font-bold text-lg">
                  {item.votes_down || 0}
                </span>
              </button>
            </div>

            {/* Link Externo */}
            <button
              onClick={() => OpenUrl(item.url)}
              className="flex items-center gap-3 px-6 py-3 bg-surface-900 dark:bg-primary-600 text-white dark:text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-surface-900/10 dark:shadow-primary-600/20"
            >
              <IconBrandGithub size={20} />
              <span>{t("detail.view_discussion")}</span>
              <IconExternalLink size={16} className="opacity-50" />
            </button>
          </div>

          {/* Footer Info */}
          <div className="mt-auto pt-16 w-full max-w-4xl flex flex-wrap items-end justify-between border-t border-surface-200 dark:border-white/10 pb-8 gap-6">
            <div className="flex flex-col items-start gap-3">
              <span className="text-xs font-medium text-surface-400 uppercase tracking-widest">
                {t("detail.project_status")}
              </span>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-50 dark:bg-white/5 border border-surface-200 dark:border-white/10`}
              >
                <column.icon size={20} className={column.text} />
                <span className={`font-bold ${column.text}`}>
                  {column.label}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              <span className="text-xs font-medium text-surface-400 uppercase tracking-widest">
                {t("detail.labels")}
              </span>
              <div className="flex flex-wrap justify-end gap-2">
                {(item.labels || []).map((l) => (
                  <span
                    key={l}
                    className="px-3 py-1 rounded-md bg-surface-100 dark:bg-white/5 text-xs font-bold text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-white/10"
                  >
                    {l}
                  </span>
                ))}
                {!item.labels?.length && (
                  <span className="text-surface-400 text-sm italic">
                    {t("detail.no_labels")}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Fim Footer Info */}
        </div>
        {/* Fim Container Central */}
      </div>
      {/* Fim Área Scrollable */}
    </motion.div>
  );
}
