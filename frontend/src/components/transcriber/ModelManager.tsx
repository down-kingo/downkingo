import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconX,
  IconDownload,
  IconTrash,
  IconCheck,
  IconLoader2,
  IconPackage,
  IconAlertTriangle,
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
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

const MODEL_QUALITY: Record<
  string,
  { stars: number; badge?: "recommended" | "best" }
> = {
  tiny: { stars: 1 },
  base: { stars: 2, badge: "recommended" },
  small: { stars: 3 },
  medium: { stars: 4 },
  "large-v3-turbo": { stars: 5, badge: "best" },
};

/** Formata o nome do modelo para exibição: "large-v3-turbo" → "Large V3 Turbo" */
function formatModelName(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function QualityDots({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${
            i < count ? "bg-primary-500" : "bg-surface-200 dark:bg-white/[0.12]"
          }`}
        />
      ))}
    </div>
  );
}

// ── Card de modelo disponível — layout 2 linhas ───────────────────

function ModelRow({
  model,
  isDownloaded,
  isDownloading,
  anyDownloading,
  onDownload,
  t,
}: {
  model: AvailableModel;
  isDownloaded: boolean;
  isDownloading: boolean;
  anyDownloading: boolean;
  onDownload: () => void;
  t: TFunction;
}) {
  const meta = MODEL_QUALITY[model.name] ?? { stars: 2 };
  const key = model.name.replace(/-/g, "_");
  const desc = t(`model_descriptions.${key}`, {
    defaultValue: model.description ?? "",
  });
  const useCase = t(`model_descriptions.${key}_use`, { defaultValue: "" });
  const badgeLabel =
    meta.badge === "recommended"
      ? t("setup_recommended")
      : meta.badge === "best"
        ? "Best"
        : null;

  return (
    <div
      className={[
        "flex items-start gap-3 px-4 py-3 transition-colors",
        isDownloaded
          ? "bg-emerald-50/40 dark:bg-emerald-500/[0.05]"
          : "hover:bg-surface-50 dark:hover:bg-white/[0.03]",
      ].join(" ")}
    >
      {/* Ícone de status */}
      <div
        className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isDownloaded
            ? "bg-emerald-100 dark:bg-emerald-500/20"
            : "bg-surface-100 dark:bg-white/[0.07]"
        }`}
      >
        {isDownloading ? (
          <IconLoader2 size={14} className="animate-spin text-primary-500" />
        ) : isDownloaded ? (
          <IconCheck
            size={14}
            className="text-emerald-600 dark:text-emerald-400"
          />
        ) : (
          <IconDownload
            size={14}
            className="text-surface-400 dark:text-white/40"
          />
        )}
      </div>

      {/* Bloco de texto — ocupa todo o espaço disponível */}
      <div className="flex-1 min-w-0">
        {/* Linha 1: nome + badge + size + dots (tudo na mesma linha) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Nome sem truncate — nunca oculto */}
          <span className="text-[13px] font-bold text-surface-900 dark:text-white whitespace-nowrap">
            {formatModelName(model.name)}
          </span>

          {badgeLabel && (
            <span
              className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full flex-shrink-0
                             bg-primary-100 dark:bg-primary-500/20
                             text-primary-600 dark:text-primary-400
                             uppercase tracking-wide"
            >
              {badgeLabel}
            </span>
          )}

          {/* Separador + tamanho + dots — alinhados com o nome na mesma linha */}
          <span className="text-surface-200 dark:text-white/15 ml-0.5">·</span>
          <span className="text-[11px] font-mono text-surface-400 dark:text-white/40 whitespace-nowrap">
            {model.size}
          </span>
          <QualityDots count={meta.stars} />
        </div>

        {/* Linha 2: descrição + caso de uso — sem truncate, espaço total */}
        {(desc || useCase) && (
          <p className="text-[11.5px] text-surface-500 dark:text-white/45 mt-0.5 leading-snug">
            {desc}
            {desc && useCase && (
              <span className="text-surface-400 dark:text-white/30 italic">
                {" "}
                · {useCase}
              </span>
            )}
            {!desc && useCase && <span className="italic">{useCase}</span>}
          </p>
        )}
      </div>

      {/* Botão de ação — alinhado ao topo da linha 1 */}
      <div className="flex-shrink-0 pt-0.5">
        {!isDownloaded ? (
          <button
            onClick={onDownload}
            disabled={anyDownloading}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap",
              "border transition-all",
              isDownloading
                ? "border-primary-300 dark:border-primary-500/40 text-primary-500 bg-primary-50 dark:bg-primary-500/10 cursor-not-allowed"
                : anyDownloading
                  ? "border-surface-200 dark:border-white/10 text-surface-300 dark:text-white/20 cursor-not-allowed"
                  : "border-surface-200 dark:border-white/10 text-surface-600 dark:text-white/60 hover:border-primary-400 dark:hover:border-primary-500/40 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/[0.08]",
            ].join(" ")}
          >
            {isDownloading ? (
              <>
                <IconLoader2 size={11} className="animate-spin" />
                <span>{t("downloading")}</span>
              </>
            ) : (
              <>
                <IconDownload size={11} />
                <span>{t("download")}</span>
              </>
            )}
          </button>
        ) : (
          /* Botão desativado/vazio — mantém alinhamento */
          <div className="w-[70px]" />
        )}
      </div>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadModels = async () => {
    try {
      const [downloaded, available] = await Promise.all([
        ListWhisperModels(),
        GetAvailableWhisperModels(),
      ]);
      setDownloadedModels(downloaded || []);
      setAvailableModels(available || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(t("error_transcribe", { defaultValue: `Failed to load models: ${msg}` }));
    }
  };

  useEffect(() => {
    if (isOpen) loadModels();
  }, [isOpen]);

  const handleDownload = async (modelName: string) => {
    setDownloadingModel(modelName);
    setErrorMessage(null);
    try {
      await DownloadWhisperModel(modelName);
      await loadModels();
      onModelsChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(t("error_download_model", { model: modelName, defaultValue: `Failed to download ${modelName}: ${msg}` }));
    } finally {
      setDownloadingModel(null);
    }
  };

  const handleDelete = async (modelName: string) => {
    setDeletingModel(modelName);
    setErrorMessage(null);
    try {
      await DeleteWhisperModel(modelName);
      await loadModels();
      onModelsChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(t("error_delete_model", { model: modelName, defaultValue: `Failed to delete ${modelName}: ${msg}` }));
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          {/* 640px — largo o suficiente para texto fluir sem quebra excessiva */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="bg-white dark:bg-[#111113]
                       border border-surface-200 dark:border-white/10
                       rounded-2xl shadow-2xl shadow-black/20
                       w-full max-w-[640px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 pt-4 pb-3.5
                            border-b border-surface-100 dark:border-white/[0.08]"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-500/15
                                flex items-center justify-center"
                >
                  <IconPackage
                    size={14}
                    className="text-primary-600 dark:text-primary-400"
                  />
                </div>
                <div>
                  <h2 className="text-[13.5px] font-bold text-surface-900 dark:text-white">
                    {t("models_title")}
                  </h2>
                  <p className="text-[11px] text-surface-400 dark:text-white/40">
                    {t("models_subtitle")}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center
                           text-surface-400 dark:text-white/35
                           hover:text-surface-700 dark:hover:text-white
                           hover:bg-surface-100 dark:hover:bg-white/[0.07] transition-colors"
              >
                <IconX size={14} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[70vh] custom-scrollbar">
              {/* Error banner */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/40 flex items-center gap-2"
                  >
                    <IconAlertTriangle size={14} className="text-red-500 dark:text-red-400 flex-shrink-0" />
                    <p className="text-[11.5px] text-red-700 dark:text-red-300 font-medium flex-1">{errorMessage}</p>
                    <button
                      onClick={() => setErrorMessage(null)}
                      className="text-red-400 hover:text-red-600 dark:hover:text-red-200 transition-colors flex-shrink-0"
                    >
                      <IconX size={12} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Modelos baixados ── */}
              {downloadedModels.length > 0 && (
                <div>
                  <div
                    className="px-5 py-2 bg-surface-50/60 dark:bg-white/[0.015]
                                  border-b border-surface-100 dark:border-white/[0.06]"
                  >
                    <p className="text-[10px] font-bold text-surface-400 dark:text-white/35 uppercase tracking-wider">
                      {t("downloaded_models")}
                    </p>
                  </div>

                  {downloadedModels.map((model, i) => (
                    <div
                      key={model.name}
                      className={[
                        "flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-50 dark:hover:bg-white/[0.03]",
                        i > 0 &&
                          "border-t border-surface-100 dark:border-white/[0.05]",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div
                        className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/15
                                      flex items-center justify-center flex-shrink-0"
                      >
                        <IconCheck
                          size={14}
                          className="text-emerald-600 dark:text-emerald-400"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-surface-900 dark:text-white">
                            {formatModelName(model.name)}
                          </span>
                          <span className="text-[11px] font-mono text-surface-400 dark:text-white/35">
                            {formatSize(model.size)}
                          </span>
                        </div>
                        {(() => {
                          const key = model.name.replace(/-/g, "_");
                          const desc = t(`model_descriptions.${key}`, {
                            defaultValue: "",
                          });
                          return desc ? (
                            <p className="text-[11px] text-surface-400 dark:text-white/35 mt-0.5">
                              {desc}
                            </p>
                          ) : null;
                        })()}
                      </div>
                      <button
                        onClick={() => handleDelete(model.name)}
                        disabled={deletingModel === model.name}
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                                   text-surface-300 dark:text-white/20
                                   hover:text-red-500 dark:hover:text-red-400
                                   hover:bg-red-50 dark:hover:bg-red-500/[0.08]
                                   transition-colors disabled:opacity-40"
                      >
                        {deletingModel === model.name ? (
                          <IconLoader2 size={13} className="animate-spin" />
                        ) : (
                          <IconTrash size={13} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Modelos disponíveis ── */}
              <div>
                <div
                  className="px-5 py-2 bg-surface-50/60 dark:bg-white/[0.015]
                                border-b border-surface-100 dark:border-white/[0.06]"
                >
                  <p className="text-[10px] font-bold text-surface-400 dark:text-white/35 uppercase tracking-wider">
                    {t("available_models")}
                  </p>
                </div>

                {availableModels.map((model, i) => (
                  <div
                    key={model.name}
                    className={
                      i > 0
                        ? "border-t border-surface-100 dark:border-white/[0.05]"
                        : ""
                    }
                  >
                    <ModelRow
                      model={model}
                      isDownloaded={downloadedNames.has(model.name)}
                      isDownloading={downloadingModel === model.name}
                      anyDownloading={!!downloadingModel}
                      onDownload={() => handleDownload(model.name)}
                      t={t}
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
