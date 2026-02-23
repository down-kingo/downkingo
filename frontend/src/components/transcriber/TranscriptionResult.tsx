import { useState } from "react";
import { motion } from "framer-motion";
import { IconCopy, IconCheck, IconDownload, IconFileWord } from "@tabler/icons-react";
import type { TFunction } from "i18next";
import { ExportTranscriptionDOCX } from "../../../bindings/kingo/app";

interface TranscriptionResultProps {
  text: string;
  outputFormat?: string;
  t: TFunction;
}

export default function TranscriptionResult({ text, outputFormat = "txt", t }: TranscriptionResultProps) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ext = outputFormat === "srt" ? "srt" : outputFormat === "vtt" ? "vtt" : "txt";
  const mimeType = ext === "srt" ? "application/x-subrip" : ext === "vtt" ? "text/vtt" : "text/plain";

  const handleSave = () => {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = `transcription.${ext}`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDOCX = async () => {
    setExporting(true);
    try {
      await ExportTranscriptionDOCX(text);
    } catch (err) {
      console.error("DOCX export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
            {t("result")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            title={t("copy")}
          >
            {copied ? <IconCheck size={14} className="text-green-500" /> : <IconCopy size={14} />}
          </button>
          <button
            onClick={handleSave}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            title={t("save")}
          >
            <IconDownload size={14} />
          </button>
          <button
            onClick={handleExportDOCX}
            disabled={exporting}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-40"
            title={t("save_docx")}
          >
            <IconFileWord size={14} />
          </button>
        </div>
      </div>

      <div className="bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-surface-200 rounded-xl p-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
        <p className="text-xs text-surface-700 dark:text-surface-300 leading-relaxed whitespace-pre-wrap font-mono">
          {text}
        </p>
      </div>
    </motion.div>
  );
}
