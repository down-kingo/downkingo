import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconX,
  IconCheck,
  IconAlertCircle,
  IconLoader2,
  IconClock,
  IconPencil,
} from "@tabler/icons-react";
import type { BatchFileItem } from "./types";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

interface BatchFileListProps {
  files: BatchFileItem[];
  onRemove: (id: string) => void;
  onUpdateCustomName: (id: string, name: string) => void;
  isProcessing: boolean;
  showCustomName: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

export const BatchFileList = memo(function BatchFileList({
  files,
  onRemove,
  onUpdateCustomName,
  isProcessing,
  showCustomName,
  t,
}: BatchFileListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (files.length === 0) return null;

  const succeeded = files.filter((f) => f.status === "done").length;
  const failed = files.filter((f) => f.status === "error").length;

  return (
    <motion.div
      layout
      className="bg-white dark:bg-surface-100 rounded-2xl border border-surface-200 dark:border-white/10 overflow-hidden shadow-sm"
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider">
            {t("files_selected", { count: files.length })}
          </span>
          {(succeeded > 0 || failed > 0) && (
            <div className="flex gap-2 text-[10px]">
              {succeeded > 0 && (
                <span className="text-green-600 font-medium">
                  {t("batch_succeeded", { count: succeeded })}
                </span>
              )}
              {failed > 0 && (
                <span className="text-red-500 font-medium">
                  {t("batch_failed", { count: failed })}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
          <AnimatePresence>
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  {/* Status icon */}
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {file.status === "pending" && (
                      <IconClock size={14} className="text-surface-400" />
                    )}
                    {file.status === "processing" && (
                      <IconLoader2
                        size={14}
                        className="text-primary-500 animate-spin"
                      />
                    )}
                    {file.status === "done" && (
                      <IconCheck size={14} className="text-green-500" />
                    )}
                    {file.status === "error" && (
                      <IconAlertCircle size={14} className="text-red-500" />
                    )}
                  </div>

                  {/* File name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-surface-700 dark:text-surface-300 truncate">
                      {file.fileName}
                    </p>
                    {file.status === "done" && file.result && (
                      <p className="text-[10px] text-green-600">
                        {formatSize(file.result.inputSize)} →{" "}
                        {formatSize(file.result.outputSize)}
                      </p>
                    )}
                    {file.status === "error" && file.error && (
                      <p className="text-[10px] text-red-500 truncate">
                        {file.error}
                      </p>
                    )}
                  </div>

                  {/* Edit name button */}
                  {showCustomName && !isProcessing && file.status === "pending" && (
                    <button
                      onClick={() =>
                        setEditingId(editingId === file.id ? null : file.id)
                      }
                      title={t("output_name")}
                      className={`p-1 rounded transition-all ${
                        editingId === file.id
                          ? "text-primary-500 bg-primary-50 dark:bg-primary-900/20"
                          : "opacity-0 group-hover:opacity-100 text-surface-400 hover:text-primary-500"
                      }`}
                    >
                      <IconPencil size={12} />
                    </button>
                  )}

                  {/* Remove button */}
                  {!isProcessing && (
                    <button
                      onClick={() => onRemove(file.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-surface-400 hover:text-red-500 rounded transition-all"
                    >
                      <IconX size={12} />
                    </button>
                  )}
                </div>

                {/* Inline custom name editor */}
                {showCustomName && editingId === file.id && file.status === "pending" && (
                  <div className="mt-1.5 ml-7">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-surface-400 shrink-0">
                        {t("output_name")}:
                      </span>
                      <input
                        type="text"
                        value={file.customName}
                        onChange={(e) =>
                          onUpdateCustomName(file.id, e.target.value)
                        }
                        placeholder={file.fileName.replace(/\.[^.]+$/, "")}
                        className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-surface-50 dark:bg-black/20 rounded-lg border border-surface-200 dark:border-surface-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none text-surface-700 dark:text-surface-300 placeholder:text-surface-300 dark:placeholder:text-surface-500"
                        autoFocus
                      />
                    </div>
                    <p className="text-[9px] text-surface-400 mt-0.5 ml-0.5">
                      {t("output_name_placeholder")}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
});
