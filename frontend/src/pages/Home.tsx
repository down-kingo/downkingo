import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDownloadStore } from "../stores/downloadStore";
import {
  GetVideoInfo,
  Download,
  GetDownloadsPath,
} from "../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";

export default function Home() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadsPath, setDownloadsPath] = useState("");

  const {
    queue,
    addToQueue,
    updateInfo,
    updateProgress,
    setCurrentId,
    clearCompleted,
  } = useDownloadStore();

  useEffect(() => {
    // Get downloads path
    GetDownloadsPath().then(setDownloadsPath);

    // Listen for download progress
    EventsOn("download:progress", (data: any) => {
      const current = queue.find(
        (q) =>
          q.progress.status === "downloading" || q.progress.status === "merging"
      );
      if (current) {
        updateProgress(current.id, data);
      }
    });

    return () => {
      EventsOff("download:progress");
    };
  }, [queue]);

  const handleFetchInfo = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const id = addToQueue(url);
      setCurrentId(id);
      updateProgress(id, { status: "fetching" });

      const info = await GetVideoInfo(url);
      updateInfo(id, info as any);
      updateProgress(id, { status: "idle" });
      setUrl("");
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (id: string) => {
    const item = queue.find((q) => q.id === id);
    if (!item) return;

    try {
      updateProgress(id, { status: "downloading", percent: 0 });
      await Download({
        url: item.url,
        format: item.format,
        audioOnly: item.audioOnly,
      });
      updateProgress(id, { status: "complete", percent: 100 });
    } catch (err) {
      updateProgress(id, { status: "error" });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatViews = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K views`;
    return `${count} views`;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-surface-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-surface-900">
            Kinematic
          </h1>
          <span className="text-sm text-surface-500">{downloadsPath}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* URL Input */}
        <motion.div
          className="card p-6 mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <label className="block text-sm font-medium text-surface-700 mb-2">
            Cole a URL do vídeo
          </label>
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFetchInfo()}
              placeholder="https://youtube.com/watch?v=..."
              className="input flex-1"
              disabled={isLoading}
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleFetchInfo}
              disabled={isLoading || !url.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                "Buscar"
              )}
            </motion.button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-sm text-red-600"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Queue Header */}
        {queue.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold text-surface-900">
              Fila de Downloads
            </h2>
            <button
              onClick={clearCompleted}
              className="text-sm text-surface-500 hover:text-surface-700 transition-colors"
            >
              Limpar concluídos
            </button>
          </div>
        )}

        {/* Download Queue */}
        <div className="space-y-4">
          <AnimatePresence>
            {queue.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="card overflow-hidden"
              >
                <div className="flex">
                  {/* Thumbnail */}
                  {item.info?.thumbnail && (
                    <div className="w-48 h-28 bg-surface-100 flex-shrink-0">
                      <img
                        src={item.info.thumbnail}
                        alt={item.info.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                      <h3 className="font-medium text-surface-900 line-clamp-2 mb-1">
                        {item.info?.title || "Buscando informações..."}
                      </h3>
                      {item.info && (
                        <p className="text-sm text-surface-600">
                          {item.info.uploader} •{" "}
                          {formatDuration(item.info.duration)} •{" "}
                          {formatViews(item.info.view_count)}
                        </p>
                      )}
                    </div>

                    {/* Progress / Actions */}
                    <div className="mt-3">
                      {item.progress.status === "downloading" ||
                      item.progress.status === "merging" ? (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-surface-600">
                              {item.progress.status === "merging"
                                ? "Processando..."
                                : `${item.progress.percent.toFixed(0)}%`}
                            </span>
                            {item.progress.speed && (
                              <span className="text-surface-500">
                                {item.progress.speed}
                              </span>
                            )}
                          </div>
                          <div className="progress-bar">
                            <motion.div
                              className="progress-bar-fill"
                              initial={{ width: 0 }}
                              animate={{ width: `${item.progress.percent}%` }}
                            />
                          </div>
                        </div>
                      ) : item.progress.status === "complete" ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span className="font-medium">Concluído</span>
                        </div>
                      ) : item.progress.status === "error" ? (
                        <span className="text-red-600 font-medium">
                          Erro no download
                        </span>
                      ) : item.info ? (
                        <div className="flex gap-2">
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => handleDownload(item.id)}
                            className="btn-primary py-2 px-4 text-sm"
                          >
                            Baixar MP4
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={() => {
                              updateProgress(item.id, {
                                status: "downloading",
                              });
                              // TODO: Download as MP3
                            }}
                            className="btn-secondary py-2 px-4 text-sm"
                          >
                            Baixar MP3
                          </motion.button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-surface-500">
                          <svg
                            className="w-4 h-4 animate-spin"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          <span>Buscando informações...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {queue.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-surface-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
            </div>
            <h3 className="font-display text-xl font-semibold text-surface-900 mb-2">
              Nenhum download na fila
            </h3>
            <p className="text-surface-600 max-w-md mx-auto">
              Cole uma URL do YouTube acima para começar a baixar vídeos e
              músicas.
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
