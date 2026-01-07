import React, { memo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { shallow } from "zustand/shallow";
import {
  IconCheck,
  IconX,
  IconTrash,
  IconVideo,
  IconFolder,
  IconWorld,
  IconHistory,
} from "@tabler/icons-react";
import { useDownloadStore, type Download } from "../stores/downloadStore";
import { useDownloadSync } from "../hooks/useDownloadSync";
import { OpenDownloadFolder, OpenUrl } from "../../wailsjs/go/main/App";

export const HistoryView = memo(function HistoryView() {
  const { t } = useTranslation("common");
  const history = useDownloadStore((state) => state.history, shallow);
  const { clearHistory } = useDownloadSync();

  const getStatusBadge = (download: Download) => {
    const badges: Record<string, React.ReactNode> = {
      pending: (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-200 text-surface-600 dark:bg-surface-800 dark:text-surface-400">
          <span className="w-1.5 h-1.5 rounded-full bg-surface-500" />
          {t("status.in_queue")}
        </span>
      ),
      downloading: (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          {download.progress.toFixed(0)}%
        </span>
      ),
      merging: (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
          {t("status.processing")}
        </span>
      ),
      completed: (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300">
          <IconCheck size={12} />
          {t("status.completed")}
        </span>
      ),
      failed: (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <IconX size={12} />
          {t("status.error")}
        </span>
      ),
      cancelled: (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-200 text-surface-600 dark:bg-surface-800 dark:text-surface-400">
          {t("status.cancelled")}
        </span>
      ),
    };
    return badges[download.status] || null;
  };

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      {history.length > 0 ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold font-display text-surface-900 dark:text-white">
              {t("home.history_title")}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-surface-500">
                {history.length} downloads
              </span>
              <button
                onClick={clearHistory}
                className="p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Limpar Histórico"
              >
                <IconTrash size={16} />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {history.slice(0, 20).map((download, index) => (
              <motion.div
                key={download.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="group relative bg-white dark:bg-surface-100 border border-surface-200 dark:border-white/10 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300"
              >
                <div className="flex">
                  <div className="w-32 h-20 bg-surface-100 dark:bg-surface-800 flex-shrink-0 relative overflow-hidden flex items-center justify-center">
                    {download.thumbnail ? (
                      <img
                        src={download.thumbnail}
                        alt={download.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : null}
                    <IconVideo size={20} className="text-surface-300" />
                  </div>
                  <div className="flex-1 p-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="font-medium text-surface-900 dark:text-white truncate text-sm">
                        {download.title}
                      </h3>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {download.uploader}
                      </p>
                    </div>
                    {getStatusBadge(download)}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 justify-center pr-3 border-l border-surface-200/50 dark:border-white/5 pl-3 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        OpenDownloadFolder(download.id);
                      }}
                      className="p-1.5 text-surface-400 hover:text-primary-500 hover:bg-surface-200/50 dark:hover:bg-white/10 rounded-lg transition-colors"
                      title={t("actions.openFolder")}
                    >
                      <IconFolder size={18} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        OpenUrl(download.url);
                      }}
                      className="p-1.5 text-surface-400 hover:text-secondary-500 hover:bg-surface-200/50 dark:hover:bg-white/10 rounded-lg transition-colors"
                      title={t("actions.openUrl")}
                    >
                      <IconWorld size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 opacity-50">
          <div className="w-20 h-20 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-4">
            <IconHistory
              size={32}
              className="text-surface-300 dark:text-surface-600"
            />
          </div>
          <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-1">
            {t("home.empty_history_title")}
          </h3>
          <p className="text-sm text-surface-500">
            {t("home.empty_history_text")}
          </p>
        </div>
      )}
    </motion.div>
  );
});
