import { motion, AnimatePresence } from "framer-motion";
import {
  IconDownload,
  IconRocket,
  IconX,
  IconCheck,
  IconAlertCircle,
} from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import { useState, useEffect } from "react";
import {
  CheckForUpdate,
  DownloadAndApplyUpdate,
  RestartApp,
} from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import type { updater } from "../../wailsjs/go/models";

export default function UpdateModal() {
  const [updateInfo, setUpdateInfo] = useState<updater.UpdateInfo | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "downloading" | "applying" | "complete" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Check for updates on mount
  useEffect(() => {
    checkUpdate();

    // Listen for progress events
    const cleanup = EventsOn("updater:progress", (data: any) => {
      // data: { status: string, percent: number }
      if (data.status === "downloading") {
        setStatus("downloading");
        setProgress(data.percent);
      } else if (data.status === "applying") {
        setStatus("applying");
        setProgress(100);
      } else if (data.status === "complete") {
        setStatus("complete");
      }
    });

    return () => {
      // Cleanup listener if possible (Wails runtime doesn't expose Off easily without wrapper,
      // but component lifecycle usually handles this fine in SPA if singleton)
    };
  }, []);

  const checkUpdate = async () => {
    try {
      const info = await CheckForUpdate();
      console.log("Update check:", info);
      if (info && info.available) {
        setUpdateInfo(info);
        setIsOpen(true);
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
    }
  };

  const handleUpdate = async () => {
    if (!updateInfo?.downloadUrl) return;
    setStatus("downloading");
    setError(null);
    try {
      await DownloadAndApplyUpdate(updateInfo.downloadUrl);
      // Status will be updated via events, but final success usually triggers restart or complete
    } catch (err) {
      console.error("Update failed:", err);
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Erro desconhecido ao atualizar."
      );
    }
  };

  const handleRestart = () => {
    RestartApp();
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen || !updateInfo) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-white dark:bg-[#121214] border border-transparent dark:border-white/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-surface-100 dark:border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="flex items-start gap-4 relative z-10">
              <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-primary-600 dark:text-primary-400">
                <IconRocket size={24} stroke={1.5} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-surface-900 dark:text-white">
                  Nova Versão Disponível
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-medium text-surface-500 line-through opacity-70">
                    v{updateInfo.currentVersion}
                  </span>
                  <span className="text-surface-300">→</span>
                  <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold ring-1 ring-green-500/20">
                    v{updateInfo.latestVersion}
                  </span>
                </div>
              </div>
            </div>

            {status === "idle" && (
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
              >
                <IconX size={18} />
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {status === "idle" && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <h3 className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3">
                  O que há de novo
                </h3>
                <div className="bg-surface-50 dark:bg-white/5 rounded-xl p-4 text-sm border border-surface-100 dark:border-white/5">
                  <ReactMarkdown>
                    {updateInfo.changelog ||
                      "Correções de bugs e melhorias de desempenho."}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {status === "downloading" && (
              <div className="py-8 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center relative">
                  <IconDownload
                    size={32}
                    className="text-primary-600 dark:text-primary-400 animate-bounce"
                  />
                  <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 36 36"
                  >
                    <path
                      className="text-surface-200 dark:text-white/10"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="text-primary-500 transition-all duration-300 ease-out"
                      strokeDasharray={`${progress}, 100`}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                    Baixando atualização...
                  </h3>
                  <p className="text-surface-500 text-sm mt-1">
                    {progress.toFixed(0)}% concluído
                  </p>
                </div>
              </div>
            )}

            {status === "applying" && (
              <div className="py-8 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center animate-pulse">
                  <IconRocket
                    size={32}
                    className="text-yellow-600 dark:text-yellow-400"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                    Instalando...
                  </h3>
                  <p className="text-surface-500 text-sm mt-1">
                    O aplicativo será reiniciado em breve.
                  </p>
                </div>
              </div>
            )}

            {status === "complete" && (
              <div className="py-8 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                  <IconCheck
                    size={32}
                    className="text-green-600 dark:text-green-400"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-surface-900 dark:text-white">
                    Atualização Concluída!
                  </h3>
                  <p className="text-surface-500 text-sm mt-1">
                    Clique abaixo para reiniciar o aplicativo.
                  </p>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="py-8 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <IconAlertCircle
                    size={32}
                    className="text-red-600 dark:text-red-400"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
                    Falha na Atualização
                  </h3>
                  <p className="text-surface-500 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-surface-50/50 dark:bg-black/20 border-t border-surface-100 dark:border-white/5 flex justify-end gap-3">
            {status === "idle" && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors"
                >
                  Talvez mais tarde
                </button>
                <button
                  onClick={handleUpdate}
                  className="px-6 py-2 rounded-lg text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-600/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  <IconDownload size={18} />
                  Atualizar Agora
                </button>
              </>
            )}

            {status === "complete" && (
              <button
                onClick={handleRestart}
                className="w-full px-6 py-3 rounded-lg text-sm font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <IconRocket size={18} />
                Reiniciar Aplicativo
              </button>
            )}

            {status === "error" && (
              <button
                onClick={() => setStatus("idle")}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-200 hover:bg-surface-300 dark:bg-surface-700 dark:hover:bg-surface-600 text-surface-900 dark:text-white transition-colors"
              >
                Tentar Novamente
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
