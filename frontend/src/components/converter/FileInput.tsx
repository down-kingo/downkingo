import { memo, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconUpload, IconVideo, IconPhoto, IconX } from "@tabler/icons-react";

interface FileInputProps {
  inputPath: string;
  isVideoTab: boolean;
  isProcessing: boolean;
  onSelectInput: () => void;
  onSetInputPath: (path: string) => void;
  onClearInput: () => void;
  thumbnailUrl?: string;
  t: (key: string) => string;
}

/**
 * Formata o nome do arquivo a partir do caminho completo.
 */
function getFileName(path: string): string {
  return path.split("\\").pop() || path.split("/").pop() || path;
}

/**
 * Componente de input de arquivo com drag & drop real, estado selecionado e botão limpar.
 */
export const FileInput = memo(function FileInput({
  inputPath,
  isVideoTab,
  isProcessing,
  onSelectInput,
  onSetInputPath,
  onClearInput,
  thumbnailUrl,
  t,
}: FileInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0); // Evita flickering causado por eventos dos filhos

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  /**
   * No Wails, o drag & drop para arquivos do sistema operacional funciona via
   * eventos nativos. O frontend recebe o caminho real do arquivo via e.dataTransfer.files
   * porém em Wails Desktop o caminho só está disponível como `path` no objeto File.
   * Como fallback seguro, disparamos o diálogo nativo se o caminho não vier preenchido.
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragging(false);

      if (isProcessing) return;

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      // Em Wails v3 o File object expõe o path real via webkitRelativePath ou path
      const file = files[0];
      const filePath =
        (file as File & { path?: string }).path ||
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        "";

      if (filePath) {
        // Valida extensão compatível com o modo atual
        const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
        const videoExts = ["mp4", "mkv", "avi", "mov", "webm", "wmv", "flv"];
        const imageExts = [
          "jpg",
          "jpeg",
          "png",
          "webp",
          "avif",
          "bmp",
          "tiff",
          "gif",
        ];
        const valid = isVideoTab
          ? videoExts.includes(ext)
          : imageExts.includes(ext);

        if (valid) {
          onSetInputPath(filePath);
        } else {
          // Extensão incompatível — abre o diálogo nativo para o usuário escolher
          onSelectInput();
        }
      } else {
        // Fallback: abre o diálogo nativo (cobre todos os casos edge)
        onSelectInput();
      }
    },
    [isProcessing, isVideoTab, onSelectInput, onSetInputPath],
  );

  return (
    <motion.div
      layout
      className="bg-white dark:bg-surface-100 rounded-2xl border border-surface-200 dark:border-white/10 overflow-hidden shadow-sm"
    >
      <div
        className="p-3"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <AnimatePresence mode="wait">
          {inputPath ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3"
            >
              {thumbnailUrl && !isVideoTab ? (
                <img
                  src={thumbnailUrl}
                  alt="preview"
                  className="w-12 h-12 rounded-xl object-cover shadow-lg shadow-primary-500/20 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0">
                  {isVideoTab ? (
                    <IconVideo size={24} className="text-white" />
                  ) : (
                    <IconPhoto size={24} className="text-white" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-surface-900 dark:text-white truncate">
                  {getFileName(inputPath)}
                </p>
                <p className="text-xs text-surface-500 truncate mt-0.5">
                  {inputPath}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={onSelectInput}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors border border-transparent hover:border-surface-200 dark:hover:border-white/10"
                >
                  {t("change")}
                </button>
                <button
                  onClick={onClearInput}
                  disabled={isProcessing}
                  title="Remover arquivo"
                  className="p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800/50"
                >
                  <IconX size={14} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={onSelectInput}
              disabled={isProcessing}
              className={`w-full flex items-center gap-4 p-4 border-2 border-dashed rounded-xl transition-all duration-200 group cursor-pointer text-left ${
                isDragging
                  ? "border-primary-500 bg-primary-50/80 dark:bg-primary-900/20 scale-[0.99]"
                  : "border-surface-200 dark:border-white/10 hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  isDragging
                    ? "bg-primary-100 dark:bg-primary-900/40"
                    : "bg-surface-100 dark:bg-surface-800 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30"
                }`}
              >
                <IconUpload
                  size={20}
                  className={`transition-colors ${
                    isDragging
                      ? "text-primary-600 animate-bounce"
                      : "text-surface-400 group-hover:text-primary-600"
                  }`}
                />
              </div>
              <div>
                <p
                  className={`font-medium text-sm transition-colors ${
                    isDragging
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-surface-700 dark:text-surface-300 group-hover:text-primary-600 dark:group-hover:text-primary-400"
                  }`}
                >
                  {isDragging
                    ? t("drop_here") || "Solte o arquivo aqui"
                    : `${t("select_file_prefix")} ${isVideoTab ? t("video") : t("image")}`}
                </p>
                <p className="text-xs text-surface-400 mt-0.5">
                  {isVideoTab
                    ? "MP4, MKV, AVI, MOV, WebM"
                    : "JPG, PNG, WebP, AVIF, BMP"}
                  {" · "}
                  <span className="text-primary-500 dark:text-primary-400">
                    {t("or_drag_and_drop") || "ou arraste e solte"}
                  </span>
                </p>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});
