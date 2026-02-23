import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconFolder,
  IconChevronDown,
  IconPlayerPlay,
  IconLoader2,
  IconAlertCircle,
  IconCheck,
  IconFolderOpen,
  IconArrowRight,
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
  onOpenResultFolder: (outputPath: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  customOutputName?: string;
  onCustomOutputNameChange?: (name: string) => void;
  showCustomName?: boolean;
  estimatedSize?: number | null;
  fileCount?: number;
  processedCount?: number;
}

/**
 * Painel lateral de ações com seleção de destino, botão de conversão,
 * barra de progresso honesta e botão "Abrir Pasta" após sucesso.
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
  onOpenResultFolder,
  t,
  customOutputName,
  onCustomOutputNameChange,
  showCustomName,
  estimatedSize,
  fileCount = 1,
  processedCount = 0,
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

          {/* Custom Output Name */}
          {showCustomName && onCustomOutputNameChange && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
                {t("output_name")}
              </label>
              <input
                type="text"
                value={customOutputName || ""}
                onChange={(e) => onCustomOutputNameChange(e.target.value)}
                disabled={isProcessing}
                placeholder={inputPath ? getFileName(inputPath).replace(/\.[^.]+$/, "") : t("output_name_placeholder")}
                className="w-full p-2.5 bg-surface-50 dark:bg-black/20 rounded-xl border border-surface-200 dark:border-surface-200 hover:border-primary-500 dark:hover:border-primary-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors text-xs font-medium text-surface-700 dark:text-surface-300 outline-none"
              />
            </div>
          )}

          <div className="h-px bg-surface-100 dark:bg-surface-200 my-2" />

          {/* Estimated Size */}
          {estimatedSize != null && estimatedSize > 0 && !result && (
            <div className="text-center text-[10px] text-surface-500 py-1">
              <span className="font-medium">{t("estimated_size")}:</span>{" "}
              <span className="font-mono font-semibold text-surface-700 dark:text-surface-300">
                ~{formatSize(estimatedSize)}
              </span>{" "}
              <span className="text-surface-400">{t("estimate_disclaimer")}</span>
            </div>
          )}

          {/* Batch info */}
          {fileCount > 1 && isProcessing && (
            <div className="text-center text-[10px] font-medium text-primary-600 dark:text-primary-400 py-1">
              {t("batch_processing", { current: processedCount + 1, total: fileCount })}
            </div>
          )}

          {/* Progress — honesta: indeterminate (não simula 100%) */}
          <div className="space-y-3">
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-1.5"
                >
                  <div className="flex justify-between text-xs font-medium text-primary-600 dark:text-primary-400">
                    <span>{t("processing")}</span>
                    <IconLoader2 size={12} className="animate-spin" />
                  </div>
                  {/* Barra indeterminada honesta — não simula progresso falso */}
                  <div className="h-1 bg-surface-100 dark:bg-surface-800/50 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full w-1/3 bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
                      animate={{ x: ["0%", "200%", "0%"] }}
                      transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: isDisabled ? 1 : 1.02 }}
              whileTap={{ scale: isDisabled ? 1 : 0.98 }}
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
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
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
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl space-y-2"
              >
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold text-xs">
                  <IconCheck size={14} />
                  <span>{t("success")}</span>
                </div>

                {/* Tamanho antes/depois */}
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

                {/* % de economia — agora também funciona para áudio */}
                {result.compression !== 0 && (
                  <div className="text-center text-[10px] font-medium text-green-800 dark:text-green-300 pt-0.5">
                    {result.compression > 0
                      ? t("savings_of")
                      : t("increase_of")}{" "}
                    {Math.abs(result.compression).toFixed(1)}%
                  </div>
                )}

                {/* Fix #7: Botão "Abrir Pasta" — agora funcional */}
                {result.outputPath && (
                  <button
                    onClick={() => onOpenResultFolder(result.outputPath)}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800/40 text-green-800 dark:text-green-300 text-[11px] font-semibold transition-colors group"
                  >
                    <IconFolderOpen
                      size={13}
                      className="group-hover:scale-110 transition-transform"
                    />
                    <span>{t("open_folder") || "Abrir Pasta"}</span>
                    <IconArrowRight size={11} className="opacity-50" />
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});
