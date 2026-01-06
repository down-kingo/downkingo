import { motion, AnimatePresence } from "framer-motion";
import { Download } from "../stores/downloadStore";
import { useDownloadSync } from "../hooks/useDownloadSync";
import {
  IconVideo,
  IconMusic,
  IconX,
  IconClock,
  IconDownload,
  IconRocket,
} from "@tabler/icons-react";

// Helper (duplicado de utils para evitar complexidade agora)
const formatDuration = (seconds: number) => {
  if (!seconds) return "";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface QueueListProps {
  queue: Download[];
}

export default function QueueList({ queue }: QueueListProps) {
  const { cancelDownload } = useDownloadSync();

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar p-8 pb-32 bg-surface-50 dark:bg-surface-950">
      <div className="max-w-4xl mx-auto h-full flex flex-col">
        <header className="mb-8 shrink-0">
          <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
            Fila de Downloads
          </h1>
          <p className="text-surface-500">
            {queue.length === 0
              ? "Nenhum download em andamento."
              : `${queue.length} download${
                  queue.length > 1 ? "s" : ""
                } em processamento.`}
          </p>
        </header>

        <AnimatePresence mode="popLayout">
          {queue.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center text-surface-400"
            >
              <div className="w-24 h-24 bg-surface-100 rounded-full flex items-center justify-center mb-6">
                <IconDownload size={48} className="text-surface-300" />
              </div>
              <h3 className="text-lg font-medium text-surface-600 mb-1">
                A fila está vazia
              </h3>
              <p className="text-sm">
                Adicione vídeos na tela inicial para começar.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {queue.map((download) => (
                <motion.div
                  key={download.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white rounded-xl p-4 shadow-sm border border-surface-200/60 hover:shadow-md transition-shadow"
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="relative w-32 h-20 bg-surface-100 rounded-lg overflow-hidden shrink-0 group">
                      {download.thumbnail ? (
                        <img
                          src={download.thumbnail}
                          alt={download.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextElementSibling?.classList.remove(
                              "hidden"
                            );
                          }}
                        />
                      ) : null}
                      {/* Fallback Icon */}
                      <div
                        className={`absolute inset-0 flex items-center justify-center bg-surface-100 text-surface-400 ${
                          download.thumbnail ? "hidden" : ""
                        }`}
                      >
                        {download.audioOnly ? (
                          <IconMusic size={24} />
                        ) : (
                          <IconVideo size={24} />
                        )}
                      </div>

                      {/* Duration Badge */}
                      {download.duration > 0 && (
                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-sm">
                          {formatDuration(download.duration)}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <div>
                          <h3
                            className="text-sm font-semibold text-surface-900 truncate pr-4"
                            title={download.title}
                          >
                            {download.title || download.url}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-surface-500 mt-0.5">
                            <span className="font-medium text-surface-600">
                              {download.uploader || "Desconhecido"}
                            </span>
                            <span>•</span>
                            <span className="uppercase">
                              {download.format || "MP4"}
                            </span>
                          </div>
                        </div>

                        {/* Cancel Button */}
                        <button
                          onClick={() => cancelDownload(download.id)}
                          className="text-surface-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                          title="Cancelar download"
                        >
                          <IconX size={18} />
                        </button>
                      </div>

                      {/* Progress Bar & Stats */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium text-surface-500">
                          <span
                            className={
                              download.status === "downloading"
                                ? "text-primary-600"
                                : ""
                            }
                          >
                            {download.status === "merging"
                              ? "Processando..."
                              : `${download.progress.toFixed(1)}%`}
                          </span>
                          <div className="flex gap-3">
                            {download.speed && (
                              <span className="flex items-center gap-1">
                                <IconRocket size={12} />
                                {download.speed}
                              </span>
                            )}
                            {download.eta && (
                              <span className="flex items-center gap-1">
                                <IconClock size={12} />
                                {download.eta}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="h-1.5 w-full bg-surface-100 rounded-full overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${
                              download.status === "merging"
                                ? "bg-secondary-500 w-full animate-pulse" // Indeterminate/Processing
                                : "bg-primary-500"
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${download.progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
