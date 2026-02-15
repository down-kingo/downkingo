import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconX,
  IconDownload,
  IconTrash,
  IconCheck,
  IconLoader2,
} from "@tabler/icons-react";
import type { TFunction } from "i18next";
import type { ModelInfo, AvailableModel } from "./types";
import {
  ListWhisperModels,
  GetAvailableWhisperModels,
  DownloadWhisperModel,
  DeleteWhisperModel,
} from "../../../bindings/kingo/app";

interface ModelManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onModelsChanged: () => void;
  t: TFunction;
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function ModelManager({
  isOpen,
  onClose,
  onModelsChanged,
  t,
}: ModelManagerProps) {
  const [downloadedModels, setDownloadedModels] = useState<ModelInfo[]>([]);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);

  const loadModels = async () => {
    try {
      const [downloaded, available] = await Promise.all([
        ListWhisperModels(),
        GetAvailableWhisperModels(),
      ]);
      setDownloadedModels(downloaded || []);
      setAvailableModels(available || []);
    } catch (err) {
      console.error("Failed to load models:", err);
    }
  };

  useEffect(() => {
    if (isOpen) loadModels();
  }, [isOpen]);

  const handleDownload = async (modelName: string) => {
    setDownloadingModel(modelName);
    try {
      await DownloadWhisperModel(modelName);
      await loadModels();
      onModelsChanged();
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingModel(null);
    }
  };

  const handleDelete = async (modelName: string) => {
    setDeletingModel(modelName);
    try {
      await DeleteWhisperModel(modelName);
      await loadModels();
      onModelsChanged();
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingModel(null);
    }
  };

  const downloadedNames = new Set(downloadedModels.map((m) => m.name));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="bg-white dark:bg-surface-100 border border-surface-200 dark:border-white/5 rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-0">
              <div>
                <h2 className="text-base font-display font-bold text-surface-900 dark:text-white">
                  {t("models_title")}
                </h2>
                <p className="text-xs text-surface-500 dark:text-surface-500 mt-0.5">
                  {t("models_subtitle")}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 -mt-1 -mr-1 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 pt-4 overflow-y-auto max-h-[60vh] custom-scrollbar space-y-5">
              {/* Downloaded */}
              {downloadedModels.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                    {t("downloaded_models")}
                  </span>
                  <div className="border border-surface-200 dark:border-white/5 rounded-xl bg-surface-50 dark:bg-black/20 overflow-hidden divide-y divide-surface-100 dark:divide-white/5">
                    {downloadedModels.map((model) => (
                      <div
                        key={model.name}
                        className="flex items-center justify-between p-3 hover:bg-white dark:hover:bg-surface-200/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                            <IconCheck size={14} className="text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-surface-900 dark:text-white capitalize">
                              {model.name}
                            </p>
                            <p className="text-[11px] text-surface-500">
                              {formatSize(model.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(model.name)}
                          disabled={deletingModel === model.name}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                          {deletingModel === model.name ? (
                            <IconLoader2 size={14} className="animate-spin" />
                          ) : (
                            <IconTrash size={14} />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                  {t("available_models")}
                </span>
                <div className="border border-surface-200 dark:border-white/5 rounded-xl bg-surface-50 dark:bg-black/20 overflow-hidden divide-y divide-surface-100 dark:divide-white/5">
                  {availableModels.map((model) => {
                    const isDownloaded = downloadedNames.has(model.name);
                    const isDownloading = downloadingModel === model.name;

                    return (
                      <div
                        key={model.name}
                        className="flex items-center justify-between p-3 hover:bg-white dark:hover:bg-surface-200/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isDownloaded
                              ? "bg-green-100 dark:bg-green-500/20"
                              : "bg-surface-100 dark:bg-white/5"
                          }`}>
                            {isDownloaded ? (
                              <IconCheck size={14} className="text-green-600 dark:text-green-400" />
                            ) : (
                              <IconDownload size={14} className="text-surface-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-surface-900 dark:text-white capitalize">
                              {model.name}
                            </p>
                            <p className="text-[11px] text-surface-500">
                              {model.size} &middot; {model.description}
                            </p>
                          </div>
                        </div>
                        {!isDownloaded && (
                          <button
                            onClick={() => handleDownload(model.name)}
                            disabled={isDownloading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50 shrink-0 shadow-sm shadow-primary-500/20"
                          >
                            {isDownloading ? (
                              <IconLoader2 size={12} className="animate-spin" />
                            ) : (
                              <IconDownload size={12} />
                            )}
                            <span>{isDownloading ? t("downloading") : t("download")}</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
