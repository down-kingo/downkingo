import { useState, useEffect, useRef, memo } from "react";
import { tryEventsOn } from "../lib/wailsRuntime";
import {
  IconTerminal,
  IconChevronUp,
  IconChevronDown,
  IconTrash,
  IconMaximize,
} from "@tabler/icons-react";

// --- TYPES & CONSTANTS ---

type LogData = { id: string; line: string } | string;

const MAX_LOGS = 500;

const STYLES = {
  container: `group fixed bottom-0 right-0 z-40 transition-all duration-300 ease-in-out
    border-t border-surface-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]
    left-0 md:left-60 bg-surface-50 dark:bg-[#09090b] text-surface-600 font-sans cursor-pointer`,
  header: `h-9 w-full flex items-center justify-between px-4 bg-primary-50 dark:bg-[#18181b]
    hover:bg-surface-100 dark:hover:bg-[#27272a] transition-colors select-none border-b border-surface-200`,
  content: `flex-1 overflow-y-auto overflow-x-hidden bg-surface-50 dark:bg-[#09090b] p-0 cursor-text
    scrollbar-thin scrollbar-thumb-surface-200 dark:scrollbar-thumb-surface-800 scrollbar-track-transparent`,
};

// --- CUSTOM HOOKS ---

const useTerminalLogs = () => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const handler = (data: LogData) => {
      const line = typeof data === "string" ? data : data?.line;
      if (!line) return;

      setLogs((prev) => {
        const newLogs = [...prev, line];
        // Keep buffer size limited for performance
        return newLogs.length > MAX_LOGS ? newLogs.slice(-MAX_LOGS) : newLogs;
      });
    };

    // Subscribe to Wails events - both download logs and console logs
    // Use safe version that checks if runtime is ready
    const unsub1 = tryEventsOn("download:log", handler);
    const unsub2 = tryEventsOn("console:log", handler);

    // Cleanup
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

const useAutoScroll = (deps: any[]) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, deps);

  return scrollRef;
};

// --- SUB COMPONENTS ---

const LogLine = memo(({ line, index }: { line: string; index: number }) => {
  // Syntax Highlighting Config
  let colorClass = "text-surface-600 dark:text-surface-400";

  if (line.includes("ERROR") || line.includes("Erro") || line.includes("✗")) {
    colorClass =
      "text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20";
  } else if (line.includes("WARNING")) {
    colorClass =
      "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20";
  } else if (line.includes("✓") || line.includes("sucesso")) {
    colorClass = "text-emerald-700 dark:text-emerald-400";
  } else if (line.includes("[download]")) {
    colorClass = "text-cyan-700 dark:text-cyan-400";
  } else if (line.includes("[Merger]") || line.includes("Merging")) {
    colorClass = "text-purple-700 dark:text-purple-400";
  } else if (line.includes("destination:")) {
    colorClass = "text-emerald-700 dark:text-emerald-400";
  } else if (line.match(/^\d+%/)) {
    colorClass = "text-blue-600 dark:text-blue-400 font-medium";
  }

  // Parse keywords
  const parts = line.split(/(\[.*?\]|\d+\.?\d*%|ETA \S+|at \S+)/g);

  return (
    <div className="font-mono text-xs hover:bg-surface-100 dark:hover:bg-white/5 px-3 py-0.5 whitespace-pre-wrap break-all flex border-b border-transparent hover:border-surface-200 dark:hover:border-transparent transition-colors">
      <span className="text-surface-400 dark:text-surface-700 select-none mr-3 w-6 text-right text-[10px]">
        {index + 1}
      </span>
      <span className={colorClass}>
        {parts.map((part, i) => {
          if (part.startsWith("["))
            return (
              <span
                key={i}
                className="text-purple-700 dark:text-purple-400 font-semibold"
              >
                {part}
              </span>
            );
          if (part.includes("%"))
            return (
              <span
                key={i}
                className="text-emerald-600 dark:text-emerald-400 font-bold"
              >
                {part}
              </span>
            );
          if (part.includes("ETA"))
            return (
              <span key={i} className="text-amber-600 dark:text-amber-400">
                {part}
              </span>
            );
          return <span key={i}>{part}</span>;
        })}
      </span>
    </div>
  );
});

LogLine.displayName = "LogLine";

const EmptyState = () => (
  <div className="h-full flex flex-col items-center justify-center text-surface-300 dark:text-surface-700 gap-3 select-none pointer-events-none">
    <div className="p-4 bg-white dark:bg-[#18181b] rounded-full border border-surface-200 dark:border-surface-800 shadow-sm">
      <IconTerminal size={32} className="opacity-50" />
    </div>
    <span className="text-sm font-medium">Ready to capture output...</span>
  </div>
);

const TerminalControls = ({
  isOpen,
  isMaximized,
  onToggleMax,
  onClose,
  onClear,
}: any) => {
  if (!isOpen) {
    return (
      <div className="flex items-center text-surface-400 group-hover:text-surface-600 dark:text-surface-600 dark:group-hover:text-surface-400 transition-colors">
        <IconChevronUp size={16} />
      </div>
    );
  }

  return (
    <div className="flex items-center text-surface-400 dark:text-surface-500 gap-1">
      <ActionButton
        onClick={onClear}
        icon={IconTrash}
        title="Clear Console"
        hoverColor="hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
      />
      <ActionButton
        onClick={onToggleMax}
        icon={IconMaximize}
        title="Maximize"
      />
      <ActionButton
        onClick={onClose}
        icon={IconChevronDown}
        title="Minimize"
        size={16}
      />
    </div>
  );
};

const ActionButton = ({
  onClick,
  icon: Icon,
  title,
  hoverColor = "hover:bg-surface-200 dark:hover:bg-surface-700 hover:text-surface-900",
  size = 14,
}: any) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick(e);
    }}
    title={title}
    className={`p-1.5 rounded-md transition-colors ${hoverColor}`}
  >
    <Icon size={size} />
  </button>
);

// --- MAIN COMPONENT ---

interface TerminalProps {
  layout?: "sidebar" | "topbar";
}

import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

export default function Terminal({ layout = "sidebar" }: TerminalProps) {
  const { logs, clearLogs } = useTerminalLogs();

  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Keyboard shortcut integration
  useKeyboardShortcuts({
    onOpenSettings: () => {}, // Handled elsewhere
    onToggleTerminal: () => setIsOpen((prev) => !prev),
  });

  // Dynamic style for left offset
  const leftOffsetClass = layout === "sidebar" ? "md:left-60" : "left-0";

  // Override STYLES.container dynamically
  const containerStyle = `group fixed bottom-0 right-0 z-40 transition-all duration-300 ease-in-out
    border-t border-surface-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]
    left-0 ${leftOffsetClass} bg-surface-50 dark:bg-[#09090b] text-surface-600 font-sans cursor-pointer`;

  // Auto-scroll logic dependent on logs and visibility
  const scrollRef = useAutoScroll([logs, isOpen]);

  // Derived state classes
  const heightClass = isOpen
    ? isMaximized
      ? "h-[80vh]"
      : "h-64"
    : "h-8 hover:h-9";

  return (
    <div
      className={`${containerStyle} ${heightClass}`}
      onClick={() => !isOpen && setIsOpen(true)}
    >
      <div className="h-full w-full flex flex-col">
        {/* HEADER BAR */}
        <div
          className={STYLES.header}
          onClick={(e) => {
            if (isOpen) e.stopPropagation();
            else setIsOpen(true);
          }}
        >
          {/* Left: Title & Preview */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-surface-400 group-hover:text-primary-600 dark:text-surface-500 dark:group-hover:text-primary-400 transition-colors uppercase tracking-wider">
              <IconTerminal size={14} className="stroke-[2.5]" />
              <span>Console</span>
            </div>

            {!isOpen && logs.length > 0 && (
              <div className="hidden sm:block text-[11px] font-mono text-surface-400 dark:text-surface-500 truncate max-w-[400px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block mr-2" />
                {logs[logs.length - 1]}
              </div>
            )}
          </div>

          {/* Right: Controls */}
          <TerminalControls
            isOpen={isOpen}
            isMaximized={isMaximized}
            onToggleMax={() => setIsMaximized(!isMaximized)}
            onClose={() => setIsOpen(false)}
            onClear={clearLogs}
          />
        </div>

        {/* LOG CONTENT WINDOW */}
        {isOpen && (
          <div
            ref={scrollRef}
            className={STYLES.content}
            onClick={(e) => e.stopPropagation()}
          >
            {logs.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="pb-4 pt-2">
                {logs.map((log, i) => (
                  <LogLine key={i} line={log} index={i} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
