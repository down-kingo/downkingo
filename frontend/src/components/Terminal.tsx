import { useState, useEffect, useRef, memo, useMemo } from "react";
import { tryEventsOn } from "../lib/wailsRuntime";
import {
  IconTerminal,
  IconChevronUp,
  IconChevronDown,
  IconTrash,
  IconMaximize,
  IconDownload,
  IconFileMusic,
  IconMovie,
  IconPhoto,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
  IconPlayerPlay,
  IconArrowMerge,
  IconLoader2,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

type LogType =
  | "info"
  | "progress"
  | "success"
  | "warning"
  | "error"
  | "merge"
  | "download"
  | "thumbnail"
  | "audio"
  | "system";

interface ParsedLog {
  id: number;
  type: LogType;
  message: string;
  percent?: number;
  speed?: string;
  eta?: string;
  size?: { current: string; total: string };
  raw: string;
  timestamp: Date;
}

type LogData = { id: string; line: string } | string;

const MAX_LOGS = 200;

// Regex patterns para parsing inteligente
const PATTERNS = {
  // Aria2c progress: [#2bd0ab 32KiB/139MiB(0%) CN:16 DL:123KiB ETA:19m19s]
  aria2Progress:
    /\[#\w+\s+([\d.]+\w+)\/([\d.]+\w+)\((\d+)%\).*?DL:([\d.]+\w+)(?:\s+ETA:(\S+))?\]/,

  // yt-dlp download: [download] 100% of 139.39MiB in 00:00:23 at 5.96MiB/s
  ytdlpComplete: /\[download\]\s*100%.*?of\s+([\d.]+\w+).*?at\s+([\d.]+\w+\/s)/,
  ytdlpProgress: /\[download\]\s*([\d.]+)%.*?at\s+([\d.]+\w+\/s).*?ETA\s+(\S+)/,
  ytdlpDestination: /\[download\]\s*Destination:\s*(.+)/,

  // yt-dlp info messages
  ytdlpInfo: /\[(youtube|info|Vídeo)\]\s*(.+)/i,

  // Merger
  merger: /\[Merger\]\s*(.+)/,

  // Thumbnail
  thumbnail: /\[(ThumbnailsConvertor|EmbedThumbnail)\]\s*(.+)/i,

  // Error patterns
  error: /(ERROR|Erro|✗|falha|failed)/i,

  // Success patterns
  success: /(✓|sucesso|completed|concluído)/i,

  // Warning
  warning: /(WARNING|aviso|Deleting original)/i,

  // Video info found
  videoFound: /✓\s*"(.+)"\s*encontrado/,
};

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM HOOKS
// ═══════════════════════════════════════════════════════════════════════════

const useTerminalLogs = () => {
  const [logs, setLogs] = useState<ParsedLog[]>([]);
  const logIdRef = useRef(0);

  const parseLog = (line: string): ParsedLog => {
    const id = logIdRef.current++;
    const timestamp = new Date();
    const base = { id, raw: line, timestamp };

    // Teste padrões em ordem de especificidade

    // Progress do aria2c (mais verboso)
    const aria2Match = line.match(PATTERNS.aria2Progress);
    if (aria2Match) {
      return {
        ...base,
        type: "progress",
        message: `Baixando...`,
        size: { current: aria2Match[1], total: aria2Match[2] },
        percent: parseInt(aria2Match[3]),
        speed: aria2Match[4],
        eta: aria2Match[5] || "",
      };
    }

    // Download completo do yt-dlp
    if (PATTERNS.ytdlpComplete.test(line)) {
      return {
        ...base,
        type: "success",
        message: "✅ Download concluído com sucesso!",
      };
    }

    // Progress do yt-dlp
    const ytdlpMatch = line.match(PATTERNS.ytdlpProgress);
    if (ytdlpMatch) {
      return {
        ...base,
        type: "download",
        message: "Baixando arquivo...",
        percent: parseFloat(ytdlpMatch[1]),
        speed: ytdlpMatch[2],
        eta: ytdlpMatch[3],
      };
    }

    // Destino do download
    const destMatch = line.match(PATTERNS.ytdlpDestination);
    if (destMatch) {
      const filename =
        destMatch[1].split("\\").pop()?.split("/").pop() || destMatch[1];
      return { ...base, type: "info", message: `Salvando: ${filename}` };
    }

    // Vídeo encontrado
    const foundMatch = line.match(PATTERNS.videoFound);
    if (foundMatch) {
      return {
        ...base,
        type: "success",
        message: `"${foundMatch[1]}" encontrado`,
      };
    }

    // Merger
    const mergerMatch = line.match(PATTERNS.merger);
    if (mergerMatch) {
      return { ...base, type: "merge", message: "Mesclando áudio e vídeo..." };
    }

    // Thumbnail
    const thumbMatch = line.match(PATTERNS.thumbnail);
    if (thumbMatch) {
      return {
        ...base,
        type: "thumbnail",
        message: "Processando thumbnail...",
      };
    }

    // Erro
    if (PATTERNS.error.test(line)) {
      return { ...base, type: "error", message: line };
    }

    // Warning
    if (PATTERNS.warning.test(line)) {
      return {
        ...base,
        type: "warning",
        message: line.replace(
          /Deleting original file.+/,
          "Limpando arquivos temporários..."
        ),
      };
    }

    // Success
    if (PATTERNS.success.test(line)) {
      return { ...base, type: "success", message: line };
    }

    // Info genérico do yt-dlp
    const infoMatch = line.match(PATTERNS.ytdlpInfo);
    if (infoMatch) {
      return { ...base, type: "info", message: infoMatch[2] };
    }

    // Fallback: linha genérica
    return { ...base, type: "system", message: line };
  };

  useEffect(() => {
    const handler = (data: LogData) => {
      const line = typeof data === "string" ? data : data?.line;
      if (!line) return;

      const parsed = parseLog(line);

      setLogs((prev) => {
        // Agrupa logs de progresso consecutivos (evita spam)
        if (parsed.type === "progress" && prev.length > 0) {
          const lastLog = prev[prev.length - 1];
          if (lastLog.type === "progress") {
            // Substitui o último log de progresso ao invés de adicionar
            return [...prev.slice(0, -1), parsed];
          }
        }

        const newLogs = [...prev, parsed];
        return newLogs.length > MAX_LOGS ? newLogs.slice(-MAX_LOGS) : newLogs;
      });
    };

    const unsub1 = tryEventsOn("download:log", handler);
    const unsub2 = tryEventsOn("console:log", handler);

    return () => {
      unsub1?.();
      unsub2?.();
    };
  }, []);

  const clearLogs = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setLogs([]);
  };

  return { logs, clearLogs };
};

// ═══════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// Ícone dinâmico baseado no tipo de log
const LogIcon = memo(({ type }: { type: LogType }) => {
  const iconClass = "shrink-0";
  const size = 14;

  const icons: Record<LogType, React.ReactNode> = {
    info: (
      <IconInfoCircle size={size} className={`${iconClass} text-blue-400`} />
    ),
    progress: (
      <IconLoader2
        size={size}
        className={`${iconClass} text-cyan-400 animate-spin`}
      />
    ),
    success: (
      <IconCheck size={size} className={`${iconClass} text-emerald-400`} />
    ),
    warning: (
      <IconAlertTriangle
        size={size}
        className={`${iconClass} text-amber-400`}
      />
    ),
    error: (
      <IconAlertTriangle size={size} className={`${iconClass} text-red-400`} />
    ),
    merge: (
      <IconArrowMerge size={size} className={`${iconClass} text-purple-400`} />
    ),
    download: (
      <IconDownload size={size} className={`${iconClass} text-cyan-400`} />
    ),
    thumbnail: (
      <IconPhoto size={size} className={`${iconClass} text-pink-400`} />
    ),
    audio: (
      <IconFileMusic size={size} className={`${iconClass} text-violet-400`} />
    ),
    system: (
      <IconPlayerPlay size={size} className={`${iconClass} text-surface-500`} />
    ),
  };

  return <>{icons[type]}</>;
});

LogIcon.displayName = "LogIcon";

// Mini barra de progresso inline
const MiniProgressBar = memo(({ percent }: { percent: number }) => (
  <div className="w-20 h-1.5 bg-surface-800 rounded-full overflow-hidden">
    <motion.div
      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500"
      initial={{ width: 0 }}
      animate={{ width: `${percent}%` }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    />
  </div>
));

MiniProgressBar.displayName = "MiniProgressBar";

// Linha de log individual
const LogLine = memo(({ log }: { log: ParsedLog }) => {
  const bgColors: Record<LogType, string> = {
    info: "",
    progress: "bg-cyan-500/5",
    success: "bg-emerald-500/15 border-l-2 border-emerald-500",
    warning: "bg-amber-500/10",
    error: "bg-red-500/10 border-l-2 border-red-500",
    merge: "bg-purple-500/5",
    download: "bg-cyan-500/5",
    thumbnail: "bg-pink-500/5",
    audio: "bg-violet-500/5",
    system: "",
  };

  const textColors: Record<LogType, string> = {
    info: "text-surface-400",
    progress: "text-cyan-300",
    success: "text-emerald-400",
    warning: "text-amber-400",
    error: "text-red-400 font-medium",
    merge: "text-purple-300",
    download: "text-cyan-300",
    thumbnail: "text-pink-300",
    audio: "text-violet-300",
    system: "text-surface-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={`
        flex items-center gap-3 px-4 py-1.5
        ${bgColors[log.type]}
        hover:bg-surface-800/30 transition-colors rounded-sm
      `}
    >
      {/* Ícone */}
      <LogIcon type={log.type} />

      {/* Mensagem */}
      <span
        className={`flex-1 text-xs font-mono truncate ${textColors[log.type]}`}
      >
        {log.message}
      </span>

      {/* Info extra para downloads */}
      {log.type === "progress" && log.percent !== undefined && (
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <MiniProgressBar percent={log.percent} />
          <span className="text-emerald-400 w-10 text-right">
            {log.percent}%
          </span>
          {log.speed && (
            <span className="text-cyan-400 w-16 text-right">{log.speed}</span>
          )}
          {log.eta && (
            <span className="text-amber-400 w-14 text-right">
              ETA {log.eta}
            </span>
          )}
        </div>
      )}

      {/* Timestamp */}
      <span className="text-[9px] text-surface-600 tabular-nums w-14 text-right shrink-0">
        {log.timestamp.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
    </motion.div>
  );
});

LogLine.displayName = "LogLine";

// Estado vazio
const EmptyState = () => {
  const { t } = useTranslation("common");
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative"
      >
        <div className="absolute inset-0 bg-primary-500/20 rounded-full blur-xl" />
        <div className="relative p-4 bg-surface-800 rounded-2xl border border-surface-700">
          <IconTerminal size={28} className="text-surface-500" />
        </div>
      </motion.div>
      <div className="text-center">
        <p className="text-sm font-medium text-surface-400">
          {t("terminal.ready")}
        </p>
        <p className="text-xs text-surface-600 mt-1">Os logs aparecerão aqui</p>
      </div>
    </div>
  );
};

// Controles do terminal
const TerminalControls = ({
  isOpen,
  isMaximized,
  logCount,
  onToggleMax,
  onClose,
  onClear,
}: {
  isOpen: boolean;
  isMaximized: boolean;
  logCount: number;
  onToggleMax: () => void;
  onClose: () => void;
  onClear: () => void;
}) => {
  const { t } = useTranslation("common");

  if (!isOpen) {
    return (
      <div className="flex items-center gap-2 text-surface-500">
        {logCount > 0 && (
          <span className="text-[10px] font-mono bg-surface-800 px-2 py-0.5 rounded-full">
            {logCount}
          </span>
        )}
        <IconChevronUp size={16} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
        title={t("terminal.clear")}
        className="p-1.5 rounded-md text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <IconTrash size={14} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleMax();
        }}
        title={t("terminal.maximize")}
        className="p-1.5 rounded-md text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors"
      >
        <IconMaximize size={14} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title={t("terminal.minimize")}
        className="p-1.5 rounded-md text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors"
      >
        <IconChevronDown size={14} />
      </button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

import { useSettingsStore } from "../stores/settingsStore";

interface TerminalProps {
  layout?: "sidebar" | "topbar";
}

export default function Terminal({ layout = "sidebar" }: TerminalProps) {
  const { t } = useTranslation("common");
  const { logs, clearLogs } = useTerminalLogs();
  const { consoleEnabled } = useSettingsStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll quando novos logs chegam
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  // Keyboard shortcuts (só funciona se o console estiver habilitado)
  useKeyboardShortcuts({
    onOpenSettings: () => {},
    onToggleTerminal: () => consoleEnabled && setIsOpen((prev) => !prev),
  });

  // Status atual (último log significativo)
  const currentStatus = useMemo(() => {
    const significantLogs = logs.filter(
      (l) =>
        l.type === "progress" ||
        l.type === "download" ||
        l.type === "merge" ||
        l.type === "success"
    );
    return significantLogs[significantLogs.length - 1];
  }, [logs]);

  // Classes dinâmicas
  const leftOffsetClass = layout === "sidebar" ? "md:left-60" : "left-0";
  const heightClass = isOpen ? (isMaximized ? "h-[70vh]" : "h-72") : "h-10";

  // Não renderiza se o console estiver desabilitado
  if (!consoleEnabled) {
    return null;
  }

  return (
    <motion.div
      layout
      className={`
        fixed bottom-0 right-0 z-40
        left-0 ${leftOffsetClass}
        bg-[#0a0a0b] backdrop-blur-sm
        border-t border-surface-800
        ${heightClass}
        transition-[height] duration-300 ease-out
        ${!isOpen ? "cursor-pointer hover:bg-surface-900" : ""}
      `}
      onClick={() => !isOpen && setIsOpen(true)}
    >
      <div className="h-full flex flex-col">
        {/* HEADER */}
        <div
          className={`
            h-10 shrink-0 w-full flex items-center justify-between px-4
            bg-[#111113] border-b border-surface-800
            hover:bg-[#18181b] cursor-pointer
            transition-colors select-none
          `}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
        >
          {/* Lado esquerdo */}
          <div className="flex items-center gap-3">
            {/* Indicador de atividade */}
            <div className="relative flex items-center justify-center">
              {currentStatus?.type === "progress" ||
              currentStatus?.type === "download" ? (
                <>
                  <span className="absolute w-2 h-2 bg-cyan-500 rounded-full animate-ping opacity-75" />
                  <span className="relative w-2 h-2 bg-cyan-400 rounded-full" />
                </>
              ) : currentStatus?.type === "merge" ? (
                <>
                  <span className="absolute w-2 h-2 bg-purple-500 rounded-full animate-ping opacity-75" />
                  <span className="relative w-2 h-2 bg-purple-400 rounded-full" />
                </>
              ) : logs.length > 0 ? (
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
              ) : (
                <span className="w-2 h-2 bg-surface-600 rounded-full" />
              )}
            </div>

            {/* Título */}
            <div className="flex items-center gap-2">
              <IconTerminal size={14} className="text-surface-500" />
              <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                {t("nav.console")}
              </span>
            </div>

            {/* Preview do status atual quando fechado */}
            {!isOpen && currentStatus && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="hidden sm:flex items-center gap-2 text-xs font-mono text-surface-500 truncate max-w-[300px]"
              >
                <LogIcon type={currentStatus.type} />
                <span className="truncate">{currentStatus.message}</span>
                {currentStatus.percent !== undefined && (
                  <span className="text-emerald-400">
                    {currentStatus.percent}%
                  </span>
                )}
              </motion.div>
            )}
          </div>

          {/* Controles */}
          <TerminalControls
            isOpen={isOpen}
            isMaximized={isMaximized}
            logCount={logs.length}
            onToggleMax={() => setIsMaximized(!isMaximized)}
            onClose={() => setIsOpen(false)}
            onClear={clearLogs}
          />
        </div>

        {/* CONTEÚDO */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              ref={scrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {logs.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="py-1">
                  {logs.map((log) => (
                    <LogLine key={log.id} log={log} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
