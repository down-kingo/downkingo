import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconFolder,
  IconChevronDown,
  IconPlayerPlay,
  IconLoader2,
  IconAlertCircle,
  IconCheck,
} from "@tabler/icons-react";
import type { ConversionResult, ConversionTab } from "./types";

/**
 * Formata o tamanho do arquivo em formato legível.
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Obtém o nome do arquivo a partir do caminho.
 */
function getFileName(path: string): string {
  return path.split("\\").pop() || path.split("/").pop() || path;
}

interface ActionPanelProps {
  inputPath: string;
  outputDir: string;
  activeTab: ConversionTab;
  isProcessing: boolean;
  result: ConversionResult | null;
  error: string;
  onSelectOutput: () => void;
  onConvert: () => void;
  t: (key: string) => string;
}

/**
 * Painel lateral de ações com seleção de destino e botão de conversão.
 */
export const ActionPanel = memo(function ActionPanel({
  inputPath,
  outputDir,
  activeTab,
  isProcessing,
  result,
  error,
  onSelectOutput,
  onConvert,
  t,
}: ActionPanelProps) {
  const isDisabled = !inputPath || isProcessing;

  return (
    <div className="w-72 lg:w-80 shrink-0 bg-white dark:bg-surface-100 border-l border-surface-200 dark:border-surface-200 flex flex-col z-20 shadow-xl shadow-black/5">
      <div className="p-4 flex flex-col h-full">
        <h3 className="font-semibold text-sm text-surface-900 dark:text-white mb-4">
          {t("summary_action")}
        </h3>

        {/* Action Section */}
        <div className="space-y-4 flex-1">
          {/* Output Directory */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
              {t("destination")}
            </label>
            <button
              onClick={onSelectOutput}
              disabled={isProcessing}
              className="w-full p-2.5 bg-surface-50 dark:bg-black/20 rounded-xl border border-surface-200 dark:border-surface-200 hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left flex items-center gap-2 group"
            >
              <div className="w-7 h-7 rounded-lg bg-surface-200 dark:bg-surface-200 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
                <IconFolder
                  size={14}
                  className="text-surface-500 group-hover:text-primary-600 transition-colors"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-surface-700 dark:text-surface-300 truncate">
                  {outputDir ? getFileName(outputDir) : t("original_folder")}
                </p>
              </div>
              <IconChevronDown size={14} className="text-surface-400" />
            </button>
            <p className="text-[10px] text-surface-400 px-1">
              {t("destination_desc")}
            </p>
          </div>

          <div className="h-px bg-surface-100 dark:bg-surface-200 my-2" />

          {/* Main Action Button with Progress */}
          <div className="space-y-3">
            {isProcessing && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-primary-600 dark:text-primary-400">
                  <span>{t("processing")}</span>
                  <IconLoader2 size={12} className="animate-spin" />
                </div>
                <div className="h-1 bg-surface-100 dark:bg-surface-800/50 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary-600 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onConvert}
              disabled={isDisabled}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-surface-200 dark:disabled:bg-surface-200 disabled:text-surface-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-primary-500/25 disabled:shadow-none flex items-center justify-center gap-2 transition-all text-sm"
            >
              {isProcessing ? (
                <span>{t("wait")}</span>
              ) : (
                <>
                  <IconPlayerPlay size={16} className="fill-current" />
                  <span>{t("start")}</span>
                </>
              )}
            </motion.button>
          </div>

          {/* Feedback Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
              >
                <div className="flex gap-2">
                  <IconAlertCircle
                    size={16}
                    className="text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                  />
                  <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                    {error}
                  </p>
                </div>
              </motion.div>
            )}

            {result && result.success && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl space-y-2"
              >
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-xs">
                  <IconCheck size={14} />
                  <span>{t("success")}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-white/60 dark:bg-black/20 p-1.5 rounded">
                    <span className="block text-surface-500">
                      {t("before")}
                    </span>
                    <span className="font-mono font-medium">
                      {formatSize(result.inputSize)}
                    </span>
                  </div>
                  <div className="bg-white/60 dark:bg-black/20 p-1.5 rounded">
                    <span className="block text-green-600">{t("after")}</span>
                    <span className="font-mono font-bold text-green-700 dark:text-green-400">
                      {formatSize(result.outputSize)}
                    </span>
                  </div>
                </div>

                {result.compression !== 0 && (
                  <div className="text-center text-[10px] font-medium text-green-800 dark:text-green-300 pt-0.5">
                    {result.compression > 0
                      ? t("savings_of")
                      : t("increase_of")}{" "}
                    {Math.abs(result.compression).toFixed(1)}%
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});
