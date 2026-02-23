import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconUpload,
  IconFileMusic,
  IconChevronDown,
  IconLoader2,
  IconWand,
  IconX,
  IconSettings,
  IconLanguage,
  IconFileTypeTxt,
  IconCpu,
  IconWaveSine,
  IconDownload,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import {
  SelectMediaFile,
  TranscribeFile,
  ListWhisperModels,
  IsWhisperInstalled,
} from "../../bindings/kingo/app";

import {
  ModelManager,
  TranscriptionResult,
  WhisperSetup,
} from "../components/transcriber";
import type { ModelInfo, TranscribeResult } from "../components/transcriber";

const LANGUAGES = [
  "auto",
  "pt",
  "en",
  "es",
  "fr",
  "de",
  "it",
  "ja",
  "ko",
  "zh",
] as const;

const OUTPUT_FORMATS = ["txt", "srt", "vtt", "docx"] as const;

function getFileName(path: string): string {
  return path.split("\\").pop() || path.split("/").pop() || path;
}

export default function Transcriber() {
  const { t } = useTranslation("transcriber");

  const [filePath, setFilePath] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [language, setLanguage] = useState("auto");
  const [outputFormat, setOutputFormat] = useState<string>("txt");

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<TranscribeResult | null>(null);
  const [error, setError] = useState("");
  const [showModelManager, setShowModelManager] = useState(false);

  const [whisperInstalled, setWhisperInstalled] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  const loadModels = useCallback(async () => {
    setIsChecking(true);
    try {
      const installed = await IsWhisperInstalled();
      setWhisperInstalled(installed);
      if (installed) {
        const modelList = await ListWhisperModels();
        setModels(modelList || []);
        // Só auto-seleciona na primeira carga (selectedModel ainda vazio)
        if (modelList && modelList.length > 0) {
          setSelectedModel((prev) => prev || modelList[0].name);
        }
      }
    } catch {
      setWhisperInstalled(false);
    } finally {
      setIsChecking(false);
    }
    // selectedModel intencionalmente excluído das deps para evitar re-render em loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleSelectFile = async () => {
    try {
      const file = await SelectMediaFile();
      if (file) {
        setFilePath(file);
        setResult(null);
        setError("");
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const handleTranscribe = async () => {
    if (!filePath) {
      setError(t("error_no_file"));
      return;
    }
    if (!selectedModel) {
      setError(t("error_no_model"));
      return;
    }

    setIsTranscribing(true);
    setError("");
    setResult(null);

    try {
      const res = await TranscribeFile({
        filePath,
        model: selectedModel,
        // Passa "auto" explicitamente — o backend faz two-pass detection
        language: language === "auto" ? "auto" : language,
        outputFormat,
      });
      setResult(res);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsTranscribing(false);
    }
  };

  const canTranscribe =
    filePath && selectedModel && whisperInstalled && !isTranscribing;

  // Loading
  if (isChecking) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-50 dark:bg-surface-50">
        <IconLoader2 size={24} className="animate-spin text-surface-400" />
      </div>
    );
  }

  // Whisper NOT installed → wizard de setup
  if (!whisperInstalled) {
    return (
      <WhisperSetup
        t={t}
        onDone={() => {
          // Recarrega: verifica se binary foi instalado e modelos disponíveis
          loadModels();
        }}
      />
    );
  }

  // Main Interface
  return (
    <div className="flex flex-col h-full bg-surface-50 dark:bg-surface-50 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-surface-200 dark:border-white/10 bg-white dark:bg-surface-50 z-10">
        <div className="px-6 py-4">
          <h1 className="text-xl font-display font-bold text-surface-900 dark:text-white">
            {t("title")}
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Configuration */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 md:p-6 flex flex-col items-center">
            <div className="w-full max-w-2xl space-y-4">
              {/* File Input */}
              <motion.div
                layout
                className="bg-white dark:bg-surface-100 rounded-2xl border border-surface-200 dark:border-white/10 overflow-hidden shadow-sm"
              >
                <div className="p-3">
                  <AnimatePresence mode="wait">
                    {filePath ? (
                      <motion.div
                        key="selected"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-3"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0">
                          <IconFileMusic size={24} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-surface-900 dark:text-white truncate">
                            {getFileName(filePath)}
                          </p>
                          <p className="text-xs text-surface-500 truncate mt-0.5">
                            {filePath}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setFilePath("");
                            setResult(null);
                            setError("");
                          }}
                          className="p-1.5 text-surface-400 hover:text-surface-600 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                        >
                          <IconX size={16} />
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="empty"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        onClick={handleSelectFile}
                        disabled={isTranscribing}
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
                            {t("select_file")}
                          </p>
                          <p className="text-xs text-surface-400">
                            MP3, WAV, M4A, MP4, MKV, AVI
                          </p>
                        </div>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Options Card */}
              <motion.div
                layout
                className="bg-white dark:bg-surface-100 rounded-2xl border border-surface-200 dark:border-white/10 overflow-hidden shadow-sm"
              >
                <div className="p-4 space-y-4">
                  {/* Model */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                        <IconCpu size={11} /> {t("model")}
                      </label>
                      <button
                        onClick={() => setShowModelManager(true)}
                        className="text-[10px] font-semibold text-primary-600 dark:text-primary-400 hover:underline uppercase tracking-wider flex items-center gap-1"
                      >
                        <IconSettings size={10} /> {t("manage")}
                      </button>
                    </div>

                    {models.length === 0 ? (
                      /* ── Empty state: sem modelos ─────────────────── */
                      <button
                        onClick={() => setShowModelManager(true)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-dashed
                                   border-surface-200 dark:border-white/10
                                   hover:border-primary-400 dark:hover:border-primary-500/50
                                   hover:bg-primary-50/50 dark:hover:bg-primary-500/[0.06]
                                   transition-all group text-left"
                      >
                        <div
                          className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-white/[0.06]
                                        group-hover:bg-primary-100 dark:group-hover:bg-primary-500/20
                                        flex items-center justify-center flex-shrink-0 transition-colors"
                        >
                          <IconDownload
                            size={15}
                            className="text-surface-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-[12.5px] font-semibold text-surface-700 dark:text-white/80
                                        group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
                          >
                            {t("no_models")}
                          </p>
                          <p className="text-[11px] text-surface-400 dark:text-white/40 mt-0.5">
                            {t("manage_models")} →
                          </p>
                        </div>
                      </button>
                    ) : (
                      /* ── Dropdown normal ─────────────────────────── */
                      <div className="relative">
                        <select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          disabled={isTranscribing}
                          className="w-full appearance-none bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-white/10 rounded-xl px-3 py-2.5 pr-9 text-sm font-medium text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:opacity-50 transition-all"
                        >
                          {models.map((m) => (
                            <option key={m.name} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <IconChevronDown
                          size={14}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-surface-100 dark:bg-surface-200" />

                  {/* Language */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                      <IconLanguage size={11} /> {t("language")}
                    </label>
                    <div className="relative">
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        disabled={isTranscribing}
                        className="w-full appearance-none bg-surface-50 dark:bg-black/20 border border-surface-200 dark:border-surface-200 rounded-xl px-3 py-2.5 pr-9 text-sm font-medium text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:opacity-50 transition-all"
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang} value={lang}>
                            {t(`languages.${lang}`)}
                          </option>
                        ))}
                      </select>
                      <IconChevronDown
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-surface-100 dark:bg-surface-200" />

                  {/* Output Format */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                      <IconFileTypeTxt size={11} /> {t("output_format")}
                    </label>
                    <div className="flex items-center gap-2">
                      {OUTPUT_FORMATS.map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setOutputFormat(fmt)}
                          disabled={isTranscribing}
                          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 ${
                            outputFormat === fmt
                              ? "bg-surface-900 dark:bg-primary-600 text-white shadow-md shadow-primary-500/20"
                              : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="h-24" />
          </div>
        </div>

        {/* Right: Action & Result Panel */}
        <div className="w-72 lg:w-80 shrink-0 bg-white dark:bg-surface-100 border-l border-surface-200 dark:border-surface-200 flex flex-col z-20 shadow-xl shadow-black/5">
          <div className="p-4 flex flex-col h-full">
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white mb-4">
              {t("transcribe")}
            </h3>

            <div className="space-y-4 flex-1">
              {/* Processing indicator */}
              {isTranscribing && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-primary-600 dark:text-primary-400">
                    <span>{t("transcribing")}</span>
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

              {/* Action Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleTranscribe}
                disabled={!canTranscribe}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-surface-200 dark:disabled:bg-surface-200 disabled:text-surface-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-primary-500/25 disabled:shadow-none flex items-center justify-center gap-2 transition-all text-sm"
              >
                {isTranscribing ? (
                  <span>{t("transcribing")}</span>
                ) : (
                  <>
                    <IconPlayerPlay size={16} className="fill-current" />
                    <span>{t("start_transcription")}</span>
                  </>
                )}
              </motion.button>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
                  >
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                      {error}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="h-px bg-surface-100 dark:bg-surface-200" />

              {/* Result Area */}
              <div className="flex-1 min-h-0">
                {result ? (
                  <div className="flex flex-col gap-2">
                    {/* Badge: idioma detectado */}
                    {result.language && language === "auto" && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700/50 rounded-lg self-start">
                        <span className="text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                          {t("detected_lang") || "Idioma detectado"}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-800/50 px-1.5 py-0.5 rounded">
                          {result.language.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <TranscriptionResult
                      text={result.text}
                      outputFormat={outputFormat}
                      t={t}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-8">
                    <IconWaveSine
                      size={32}
                      className="text-surface-300 dark:text-surface-600 mb-3"
                    />
                    <p className="text-xs text-surface-400 dark:text-surface-500 font-medium leading-relaxed">
                      {isTranscribing
                        ? t("transcribing_desc")
                        : t("ready_desc")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Manager Modal */}
      <ModelManager
        isOpen={showModelManager}
        onClose={() => setShowModelManager(false)}
        onModelsChanged={loadModels}
        t={t}
      />
    </div>
  );
}
