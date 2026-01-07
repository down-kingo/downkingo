import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconUpload, IconVideo, IconPhoto } from "@tabler/icons-react";

interface FileInputProps {
  inputPath: string;
  isVideoTab: boolean;
  isProcessing: boolean;
  onSelectInput: () => void;
  t: (key: string) => string;
}

/**
 * Formata o nome do arquivo a partir do caminho completo.
 */
function getFileName(path: string): string {
  return path.split("\\").pop() || path.split("/").pop() || path;
}

/**
 * Componente de input de arquivo com drag area e estado selecionado.
 */
export const FileInput = memo(function FileInput({
  inputPath,
  isVideoTab,
  isProcessing,
  onSelectInput,
  t,
}: FileInputProps) {
  return (
    <motion.div
      layout
      className="bg-white dark:bg-surface-100 rounded-2xl border border-surface-200 dark:border-white/10 overflow-hidden shadow-sm"
    >
      <div className="p-3">
        <AnimatePresence mode="wait">
          {inputPath ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0">
                {isVideoTab ? (
                  <IconVideo size={24} className="text-white" />
                ) : (
                  <IconPhoto size={24} className="text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-surface-900 dark:text-white truncate">
                  {getFileName(inputPath)}
                </p>
                <p className="text-xs text-surface-500 truncate mt-0.5">
                  {inputPath}
                </p>
              </div>
              <button
                onClick={onSelectInput}
                disabled={isProcessing}
                className="px-3 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors border border-transparent hover:border-surface-200 dark:hover:border-white/10"
              >
                {t("change")}
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={onSelectInput}
              disabled={isProcessing}
              className="w-full flex items-center gap-4 p-3 border-2 border-dashed border-surface-200 dark:border-white/10 rounded-xl hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all group cursor-pointer text-left"
            >
              <div className="w-10 h-10 rounded-full bg-surface-100 dark:bg-surface-800 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 flex items-center justify-center shrink-0 transition-colors">
                <IconUpload
                  size={20}
                  className="text-surface-400 group-hover:text-primary-600 transition-colors"
                />
              </div>
              <div>
                <p className="font-medium text-sm text-surface-700 dark:text-surface-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {t("select_file_prefix")}{" "}
                  {isVideoTab ? t("video") : t("image")}
                </p>
                <p className="text-xs text-surface-400">
                  {isVideoTab ? "MP4, MKV, AVI, MOV" : "JPG, PNG, WebP, AVIF"}
                </p>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});
