import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconBulb,
  IconBrandGithub,
  IconThumbUp,
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
import { getDisplayTitle, getDisplayDescription } from "../utils/textUtils";
import type { RoadmapItem, RoadmapStatus } from "../types/roadmap";

// Backend functions
import {
  StartGitHubAuth,
  PollGitHubAuth,
  GetGitHubToken,
  SuggestFeature,
  OpenUrl,
  LogoutGitHub,
} from "../../wailsjs/go/main/App";

const COLUMNS = [
  {
    id: "idea" as RoadmapStatus,
    label: "Bastidores",
    sub: "Ideias & Conceitos",
    icon: IconBulb,
    accent: "border-yellow-500/50",
    glow: "group-hover:shadow-yellow-500/20",
    text: "text-yellow-500",
    bg: "bg-yellow-500/5",
  },
  {
    id: "planned" as RoadmapStatus,
    label: "Em Pauta",
    sub: "Planejado",
    icon: IconPlayerTrackNext,
    accent: "border-blue-500/50",
    glow: "group-hover:shadow-blue-500/20",
    text: "text-blue-500",
    bg: "bg-blue-500/5",
  },
  {
    id: "in-progress" as RoadmapStatus,
    label: "Em Produção",
    sub: "Construindo",
    icon: IconActivity,
    accent: "border-purple-500/50",
    glow: "group-hover:shadow-purple-500/20",
    text: "text-purple-500",
    bg: "bg-purple-500/5",
  },
  {
    id: "shipped" as RoadmapStatus,
    label: "No Ar",
    sub: "Entregue",
    icon: IconBroadcast,
    accent: "border-green-500/50",
    glow: "group-hover:shadow-green-500/20",
    text: "text-green-500",
    bg: "bg-green-500/5",
  },
] as const;

export default function Roadmap() {
  // Store state
  const { items, isLoading, fetchRoadmap, voteForItem, getItemsByStatus } =
    useRoadmapStore();

  const { initialize } = useRoadmapInit();

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

  // Suggestion State
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Initialize store and subscribe to live updates
    const cleanup = initialize();
    checkAuth();

    return cleanup;
  }, []);

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
        setAuthError("Resposta inválida do GitHub.");
      }
    } catch (err: unknown) {
      console.error("Auth failed", err);
      setAuthError(
        err instanceof Error ? err.message : "Falha ao iniciar autenticação."
      );
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
      }
    } catch (err: unknown) {
      console.error("Auth poll failed", err);
      setAuthError(
        err instanceof Error ? err.message : "Timeout ou erro na autorização."
      );
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
    } catch (err) {
      console.error("Vote failed", err);
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
    <div className="flex flex-col h-full bg-surface-50 dark:bg-surface-950 font-sans overflow-hidden">
      {/* Header */}
      <header className="px-8 py-6 flex items-end justify-between border-b border-surface-200/50 dark:border-white/5 bg-white/50 dark:bg-surface-950/50 backdrop-blur-xl shrink-0 z-10 sticky top-0">
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
              Live
            </span>
          </motion.div>
          <h1 className="text-2xl font-bold text-surface-900 tracking-tight bg-gradient-to-r from-surface-900 to-surface-500 bg-clip-text text-transparent dark:from-white dark:to-white/60">
            Desenvolvimento Aberto
          </h1>
        </div>

        <div className="flex gap-3">
          {!isAuthenticated ? (
            <button
              onClick={startLogin}
              className="btn btn-ghost text-xs flex items-center gap-2"
            >
              <IconBrandGithub size={16} />
              Conectar GitHub
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="btn btn-ghost text-xs text-red-500 hover:text-red-600"
            >
              Sair
            </button>
          )}

          <button
            onClick={handleSuggestionClick}
            className="group relative overflow-hidden px-5 py-2 rounded-lg bg-surface-900 dark:bg-white text-white dark:text-black shadow-lg shadow-surface-900/20 hover:shadow-surface-900/30 transition-all active:scale-95"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
            <div className="flex items-center gap-2 relative z-10 text-xs font-bold">
              <IconPlus size={14} stroke={3} />
              <span>Nova Sugestão</span>
            </div>
          </button>
        </div>
      </header>

      {/* Kanban Grid */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="grid grid-cols-4 gap-6 h-full w-full max-w-[1920px] mx-auto">
          {COLUMNS.map((col) => {
            const colItems = getItemsByStatus(col.id);
            const Icon = col.icon;

            return (
              <div
                key={col.id}
                className="flex flex-col h-full min-w-0 group/col relative bg-surface-50/50 dark:bg-surface-900/20 rounded-2xl border border-surface-200/50 dark:border-white/5 p-2"
              >
                <div className="flex items-center justify-between mb-4 px-3 pt-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg bg-surface-100 dark:bg-black/20 ${col.text} ${col.bg} border border-transparent dark:border-white/5`}
                    >
                      <Icon size={18} stroke={2} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-surface-700 dark:text-surface-200 leading-none">
                        {col.label}
                      </h3>
                      <span className="text-[10px] font-medium text-surface-400">
                        {col.sub}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-surface-400 bg-surface-200/50 dark:bg-white/5 px-2 py-0.5 rounded-full">
                    {colItems.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-3 relative pb-2">
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
                        Vazio
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
                          onVote={handleVote}
                        />
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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

interface RoadmapCardProps {
  item: RoadmapItem;
  column: (typeof COLUMNS)[number];
  index: number;
  isAuthenticated: boolean;
  onVote: (id: number) => void;
}

function RoadmapCard({
  item,
  column,
  index,
  isAuthenticated,
  onVote,
}: RoadmapCardProps) {
  const displayTitle = getDisplayTitle(item);
  const displayDescription = getDisplayDescription(item);

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
      className={`group relative bg-white dark:bg-surface-900 border border-surface-100 dark:border-white/5 p-4 rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-none hover:shadow-xl transition-all duration-300 ${column.glow} hover:border-primary-500/20 dark:hover:border-primary-500/30 overflow-hidden`}
    >
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Status indicator */}
      <div
        className={`absolute top-0 left-0 w-[3px] h-full ${column.bg.replace(
          "bg-",
          "bg-gradient-to-b from-"
        )} to-transparent opacity-60`}
      />

      <div className="relative z-10">
        <div className="flex justify-between items-start gap-3 mb-2">
          <h4
            className="text-sm font-bold text-surface-900 dark:text-surface-100 leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2"
            title={item.title} // Show original title on hover
          >
            {displayTitle}
          </h4>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-surface-300 hover:text-surface-900 dark:hover:text-white transition-colors p-1"
            >
              <IconExternalLink size={12} stroke={2} />
            </a>
          )}
        </div>

        <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed line-clamp-3 mb-4 font-medium">
          {displayDescription}
        </p>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1">
            {(item.labels || []).slice(0, 1).map((l) => (
              <span
                key={l}
                className="px-2 py-0.5 rounded-[4px] bg-surface-100 dark:bg-white/5 text-[9px] font-bold text-surface-600 dark:text-surface-400 uppercase tracking-wider border border-surface-200 dark:border-white/5 max-w-[80px] truncate"
              >
                {l}
              </span>
            ))}
          </div>

          <button
            onClick={() => onVote(item.id)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${
              isAuthenticated
                ? "hover:bg-surface-100 dark:hover:bg-white/10"
                : ""
            }`}
          >
            <IconThumbUp
              size={14}
              className={
                isAuthenticated
                  ? "text-surface-400 group-hover:text-primary-500 transition-colors"
                  : "text-surface-300"
              }
              fill={isAuthenticated && item.votes > 0 ? "currentColor" : "none"}
            />
            <span
              className={`text-xs font-bold ${
                isAuthenticated
                  ? "text-surface-600 dark:text-surface-300"
                  : "text-surface-400"
              }`}
            >
              {item.votes}
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

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
            <h2 className="text-xl font-bold mb-2">Conectar GitHub</h2>
            <p className="text-surface-400 text-sm">
              Para votar e sugerir sem sair do app, precisamos autorizar o
              DownKingo no seu GitHub.
            </p>
          </div>

          {authData ? (
            <div className="w-full space-y-4 bg-black/30 p-4 rounded-xl border border-white/5">
              <div>
                <p className="text-xs text-surface-400 mb-1 uppercase tracking-wider">
                  Seu Código:
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
                  Copiar & Abrir GitHub
                </button>
              </div>

              {isPollingAuth && (
                <div className="flex items-center justify-center gap-2 text-xs text-surface-500 pt-2 animate-pulse">
                  <IconLoader2 size={12} className="animate-spin" />
                  Aguardando autorização...
                </div>
              )}
            </div>
          ) : authError ? (
            <div className="w-full space-y-4 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
              <div className="text-center">
                <p className="text-sm text-red-400 font-medium mb-2">
                  Erro na Autenticação
                </p>
                <p className="text-xs text-surface-400 break-words">
                  {authError}
                </p>
              </div>
              <button
                onClick={onRetry}
                className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          ) : (
            <div className="py-4 flex flex-col items-center">
              <IconLoader2
                size={32}
                className="animate-spin text-surface-500"
              />
              <p className="text-xs text-surface-500 mt-2">Iniciando...</p>
            </div>
          )}

          <button
            onClick={onClose}
            className="text-xs text-surface-500 hover:text-white mt-4"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
