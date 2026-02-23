/**
 * WhisperSetup — Wizard de 2 etapas para instalar o Whisper.cpp e baixar um modelo.
 *
 * Etapa 1: Instalar o binário whisper-cli (~20 MB)
 *   - Barra de progresso real via evento "whisper:binary-progress"
 *   - Feedback de status: downloading → extracting → complete
 *
 * Etapa 2: Escolha e download de modelo
 *   - Cards para tiny / base / small / medium / large-v3-turbo
 *   - "base" recomendado por padrão
 *   - Barra de progresso real via evento "whisper:model-progress"
 *   - Botão "skip" para pular (usuário vai ao ModelManager depois)
 *
 * Ao concluir, chama onDone() → Transcriber recarrega os modelos.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconCpu,
  IconDownload,
  IconCheck,
  IconLoader2,
  IconChevronRight,
  IconBrain,
  IconShieldCheck,
  IconBolt,
} from "@tabler/icons-react";
import type { TFunction } from "i18next";
import {
  DownloadWhisperBinary,
  GetAvailableWhisperModels,
  DownloadWhisperModel,
} from "../../../bindings/kingo/app";
import { tryEventsOn, tryEventsOff } from "../../lib/wailsRuntime";
import type { AvailableModel } from "./types";

interface WhisperSetupProps {
  onDone: () => void;
  t: TFunction;
  /** Se true, pula a etapa 1 (binário já instalado) e vai direto para seleção de modelo */
  skipBinaryInstall?: boolean;
}

// ── tipos dos eventos do backend ──────────────────────────────────

interface BinaryProgressEvent {
  status: "downloading" | "extracting" | "complete";
  percent?: number;
  downloaded?: number;
  total?: number;
}

interface ModelProgressEvent {
  model: string;
  status: "downloading" | "complete";
  percent?: number;
  downloaded?: number;
  total?: number;
}

// ── helpers ───────────────────────────────────────────────────────

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 bg-surface-100 dark:bg-white/10 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-primary-600 dark:bg-primary-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
        transition={{ ease: "easeOut", duration: 0.3 }}
      />
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// Metas de cada modelo — alinhado com backend GetAvailableModels()
const MODEL_META: Record<
  string,
  { icon: typeof IconBolt; color: string; recommended?: boolean }
> = {
  tiny: { icon: IconBolt, color: "text-emerald-500" },
  base: { icon: IconBolt, color: "text-blue-500", recommended: true },
  small: { icon: IconBrain, color: "text-purple-500" },
  medium: { icon: IconBrain, color: "text-orange-500" },
  "large-v3-turbo": { icon: IconBrain, color: "text-red-500" },
};

// ── Step 1: instalar binário ──────────────────────────────────────

function StepInstallBinary({
  t,
  onDone,
}: {
  t: TFunction;
  onDone: () => void;
}) {
  const [state, setState] = useState<
    "idle" | "downloading" | "extracting" | "done" | "error"
  >("idle");
  const [percent, setPercent] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = tryEventsOn<BinaryProgressEvent>(
      "whisper:binary-progress",
      (ev) => {
        if (ev.status === "downloading") {
          setState("downloading");
          setPercent(ev.percent ?? 0);
          if (ev.downloaded) setDownloaded(ev.downloaded);
          if (ev.total) setTotal(ev.total);
        } else if (ev.status === "extracting") {
          setState("extracting");
          setPercent(100);
        } else if (ev.status === "complete") {
          setState("done");
          setPercent(100);
        }
      },
    );
    return () => {
      unsub?.();
      tryEventsOff("whisper:binary-progress");
    };
  }, []);

  const handleInstall = async () => {
    setState("downloading");
    setError("");
    setPercent(0);
    try {
      await DownloadWhisperBinary();
      setState("done");
      // Aguarda 500ms para o user ver "Done" antes de avançar
      setTimeout(onDone, 600);
    } catch (err) {
      setState("error");
      setError(String(err));
    }
  };

  const statusLabel = () => {
    if (state === "downloading")
      return total > 0
        ? `${t("setup_downloading_binary")} ${formatBytes(downloaded)} / ${formatBytes(total)}`
        : t("setup_downloading_binary");
    if (state === "extracting") return t("setup_extracting");
    if (state === "done") return t("setup_binary_done");
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Feature bullets */}
      <div className="space-y-2">
        {[
          {
            Icon: IconShieldCheck,
            text: "100% local — no data leaves your device",
          },
          { Icon: IconBrain, text: "Powered by OpenAI Whisper.cpp (~20 MB)" },
          { Icon: IconBolt, text: "Supports MP3, WAV, MP4, MKV and more" },
        ].map(({ Icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-2.5 text-[13px] text-surface-600 dark:text-white/65"
          >
            <Icon size={15} className="text-primary-500 flex-shrink-0" />
            <span>{text}</span>
          </div>
        ))}
      </div>

      {/* Progress */}
      <AnimatePresence>
        {state !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <ProgressBar percent={percent} />
            <div className="flex justify-between text-[11px] text-surface-400 dark:text-white/45">
              <span>{statusLabel()}</span>
              {state === "downloading" && <span>{percent.toFixed(0)}%</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* CTA */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleInstall}
        disabled={
          state === "downloading" || state === "extracting" || state === "done"
        }
        className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all
                   bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/20
                   disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {state === "downloading" || state === "extracting" ? (
          <>
            <IconLoader2 size={16} className="animate-spin" />
            <span>{t("installing_whisper")}</span>
          </>
        ) : state === "done" ? (
          <>
            <IconCheck size={16} />
            <span>{t("setup_binary_done")}</span>
          </>
        ) : (
          <>
            <IconDownload size={16} />
            <span>{t("install_whisper")}</span>
          </>
        )}
      </motion.button>
    </div>
  );
}

// ── Step 2: selecionar e baixar modelo ────────────────────────────

function StepSelectModel({
  t,
  onDone,
  onSkip,
}: {
  t: TFunction;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [selected, setSelected] = useState("base"); // recommended default
  const [state, setState] = useState<"idle" | "downloading" | "done" | "error">(
    "idle",
  );
  const [percent, setPercent] = useState(0);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    GetAvailableWhisperModels()
      .then((list) => setModels(list || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = tryEventsOn<ModelProgressEvent>(
      "whisper:model-progress",
      (ev) => {
        if (ev.model !== selected) return;
        if (ev.status === "downloading") {
          setState("downloading");
          setPercent(ev.percent ?? 0);
          if (ev.downloaded) setDownloaded(ev.downloaded);
          if (ev.total) setTotal(ev.total);
        } else if (ev.status === "complete") {
          setState("done");
          setPercent(100);
        }
      },
    );
    return () => {
      unsub?.();
      tryEventsOff("whisper:model-progress");
    };
  }, [selected]);

  const handleDownload = async () => {
    if (!selected) return;
    setState("downloading");
    setError("");
    setPercent(0);
    try {
      await DownloadWhisperModel(selected);
      setState("done");
      setTimeout(onDone, 600);
    } catch (err) {
      setState("error");
      setError(String(err));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-surface-500 dark:text-white/55 leading-relaxed">
        {t("setup_step2_desc")}
      </p>

      {/* Model cards */}
      <div className="space-y-2">
        {models.map((model) => {
          const meta = MODEL_META[model.name] ?? {
            icon: IconBrain,
            color: "text-surface-400",
          };
          const Icon = meta.icon;
          const active = selected === model.name;

          return (
            <button
              key={model.name}
              onClick={() => {
                if (state === "idle" || state === "error")
                  setSelected(model.name);
              }}
              disabled={state === "downloading" || state === "done"}
              className={[
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                active
                  ? "border-primary-500/50 bg-primary-50 dark:bg-primary-500/10"
                  : "border-surface-200 dark:border-white/[0.08] hover:border-surface-300 dark:hover:border-white/15 hover:bg-surface-50 dark:hover:bg-white/[0.04]",
                (state === "downloading" || state === "done") &&
                  "opacity-60 cursor-default",
              ].join(" ")}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  active
                    ? "bg-primary-100 dark:bg-primary-500/20"
                    : "bg-surface-100 dark:bg-white/[0.06]"
                }`}
              >
                <Icon
                  size={16}
                  className={
                    active
                      ? "text-primary-600 dark:text-primary-400"
                      : meta.color
                  }
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold capitalize text-surface-900 dark:text-white">
                    {model.name}
                  </span>
                  {meta.recommended && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 uppercase tracking-wide">
                      {t("setup_recommended")}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-surface-400 dark:text-white/45 mt-0.5">
                  {model.size} &middot; {model.description}
                </p>
              </div>

              <div
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                  active
                    ? "border-primary-500 bg-primary-500"
                    : "border-surface-300 dark:border-white/20"
                }`}
              >
                {active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Progress */}
      <AnimatePresence>
        {state === "downloading" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <ProgressBar percent={percent} />
            <div className="flex justify-between text-[11px] text-surface-400 dark:text-white/45">
              <span>
                {t("setup_model_downloading")}
                {total > 0 &&
                  ` ${formatBytes(downloaded)} / ${formatBytes(total)}`}
              </span>
              <span>{percent.toFixed(0)}%</span>
            </div>
          </motion.div>
        )}
        {state === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-[13px] font-medium text-emerald-600 dark:text-emerald-400"
          >
            <IconCheck size={15} />
            <span>{t("setup_model_done")}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onSkip}
          disabled={state === "downloading"}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-surface-500 dark:text-white/50
                     hover:bg-surface-100 dark:hover:bg-white/[0.05] transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t("setup_skip_model")}
        </button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleDownload}
          disabled={!selected || state === "downloading" || state === "done"}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all
                     bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/20
                     disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {state === "downloading" ? (
            <>
              <IconLoader2 size={15} className="animate-spin" />
              <span>{t("downloading")}</span>
            </>
          ) : state === "done" ? (
            <>
              <IconCheck size={15} />
              <span>{t("setup_model_done")}</span>
            </>
          ) : (
            <>
              <IconDownload size={15} />
              <span>
                {t("download")} {selected}
              </span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}

// ── Wizard container ──────────────────────────────────────────────

export default function WhisperSetup({
  t,
  onDone,
  skipBinaryInstall,
}: WhisperSetupProps) {
  const [step, setStep] = useState<1 | 2>(skipBinaryInstall ? 2 : 1);

  return (
    <div className="h-full flex items-center justify-center bg-surface-50 dark:bg-[#0d0d0f] p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-[#111113] rounded-2xl border border-surface-200 dark:border-white/10 shadow-xl shadow-black/10 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-surface-100 dark:border-white/[0.08]">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-500/15 flex items-center justify-center flex-shrink-0">
              <IconCpu
                size={18}
                className="text-primary-600 dark:text-primary-400"
              />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-surface-900 dark:text-white leading-tight">
                {step === 1 ? t("setup_step1_title") : t("setup_step2_title")}
              </h2>
              <p className="text-[12px] text-surface-400 dark:text-white/45 mt-0.5">
                {t("whisper_not_installed_desc")}
              </p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1.5 mt-4">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={[
                  "h-1 rounded-full transition-all duration-300",
                  s === step
                    ? "flex-1 bg-primary-600 dark:bg-primary-500"
                    : s < step
                      ? "w-6 bg-primary-300 dark:bg-primary-500/40"
                      : "flex-1 bg-surface-100 dark:bg-white/10",
                ].join(" ")}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
              >
                <StepInstallBinary t={t} onDone={() => setStep(2)} />
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
              >
                <StepSelectModel t={t} onDone={onDone} onSkip={onDone} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer navigation hint */}
        {step === 1 && (
          <div className="px-6 pb-5 flex items-center gap-1.5 text-[11px] text-surface-400 dark:text-white/35">
            <IconChevronRight size={12} />
            <span>Step 1 complete → model selection</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
