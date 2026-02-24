import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useLauncherStore } from "../stores/launcherStore";
import { useSettingsStore, FeatureId } from "../stores/settingsStore";
import { useTranslation } from "react-i18next";
import {
  CheckDependencies,
  DownloadDependencies,
  DownloadSelectedDependencies,
  DownloadAndApplyUpdate,
  IsWhisperInstalled,
  DownloadWhisperBinary,
} from "../../bindings/kingo/app";
import { safeEventsOn, tryEventsOff } from "../lib/wailsRuntime";
import { FEATURE_REGISTRY, ALL_FEATURE_IDS, FEATURE_DEPS } from "../lib/features";
import {
  IconCheck,
  IconX,
  IconLoader2,
  IconDownload,
  IconPackage,
} from "@tabler/icons-react";

export default function Setup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("common");
  const [isRetrying, setIsRetrying] = useState(false);

  // Setup deve ser SEMPRE claro — força light mode antes do paint
  const wasDarkRef = useRef(false);
  useLayoutEffect(() => {
    const html = document.documentElement;
    wasDarkRef.current = html.classList.contains("dark");
    html.classList.remove("dark");
    html.classList.add("light");
    return () => {
      if (wasDarkRef.current) {
        html.classList.add("dark");
        html.classList.remove("light");
      }
    };
  }, []);

  // Se vindo de Settings com features pré-selecionadas, pular direto para install
  const preselected: FeatureId[] | undefined = location.state?.preselected;
  const isFromSettings = !!preselected;

  // Feature selection step
  const [step, setStep] = useState<"features" | "install">(
    isFromSettings ? "install" : "features",
  );
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureId[]>(
    preselected ?? ["videos", "images", "converter", "transcriber"],
  );
  const setEnabledFeatures = useSettingsStore((s) => s.setEnabledFeatures);

  // Durante o onboarding, o toggle opera no estado local (antes de confirmar)
  const toggleLocalFeature = (id: FeatureId) => {
    setSelectedFeatures((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // mínimo 1
        return prev.filter((f) => f !== id);
      }
      return [...prev, id];
    });
  };

  const handleContinueFeatures = () => {
    // NÃO persiste no store aqui: a persistência ocorre apenas após instalação bem-sucedida.
    // Isso evita estado inválido se o download/install falhar.
    setStep("install");
  };

  // Preview Mode — exibe a UI sem iniciar downloads (dev only)
  const isPreview = location.state?.preview || false;

  // Update Mode State
  const isUpdateMode = location.state?.isUpdate || false;
  const updateUrl = location.state?.downloadUrl || "";
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStatus, setUpdateStatus] = useState<
    "downloading" | "applying" | "restarting" | "complete" | "error" | "idle"
  >("idle");
  const [updateError, setUpdateError] = useState("");

  const {
    dependencies,
    progress,
    isComplete,
    error,
    setDependencies,
    updateProgress: updateLauncherProgress,
    setComplete,
    setError,
    reset,
  } = useLauncherStore();

  // Track whisper download progress separately
  const [whisperProgress, setWhisperProgress] = useState<{
    status: string;
    percent: number;
  } | null>(null);
  const needsWhisperRef = useRef(false);

  const startSetup = async () => {
    try {
      if (isUpdateMode) {
        if (!updateUrl) {
          setUpdateError("URL de atualização inválida.");
          return;
        }
        setUpdateStatus("downloading");
        await DownloadAndApplyUpdate(updateUrl);
        // O restante é via eventos
      } else {
        reset();
        setIsRetrying(false);
        needsWhisperRef.current = false;

        // Calcular dependências necessárias com base nas features selecionadas
        const requiredDepNames = [
          ...new Set(selectedFeatures.flatMap((f) => FEATURE_DEPS[f])),
        ];

        const allStatuses = await CheckDependencies();

        // Filtrar apenas as deps necessárias para as features selecionadas
        const filteredDeps = allStatuses.filter((d: { name: string }) =>
          requiredDepNames.includes(d.name),
        );

        // Se transcriber foi selecionado, verificar se whisper está instalado
        const wantsTranscriber = selectedFeatures.includes("transcriber");
        let whisperInstalled = true;
        if (wantsTranscriber) {
          try {
            whisperInstalled = await IsWhisperInstalled();
          } catch {
            whisperInstalled = false;
          }
        }

        // Adicionar Whisper à lista de dependências se necessário
        const allDeps = [...filteredDeps];
        if (wantsTranscriber) {
          allDeps.push({
            name: "Whisper",
            installed: whisperInstalled,
            size: 0,
          });
        }

        setDependencies(allDeps);
        needsWhisperRef.current = wantsTranscriber && !whisperInstalled;

        if (allDeps.every((d: { installed: boolean }) => d.installed)) {
          // Tudo já instalado — persiste features e navega
          setEnabledFeatures(selectedFeatures);
          navigate("/home");
          return;
        }

        // Baixar apenas as dependências necessárias (filtradas por features)
        const standardNeedsDownload = filteredDeps.some(
          (d: { installed: boolean }) => !d.installed,
        );
        if (standardNeedsDownload) {
          await DownloadSelectedDependencies(requiredDepNames);
          // launcher:complete será emitido pelo backend → callback faz o whisper se necessário
        } else if (needsWhisperRef.current) {
          // Dependências padrão já OK, mas whisper precisa ser baixado
          await startWhisperDownload();
        }
      }
    } catch (err) {
      if (isUpdateMode) {
        setUpdateStatus("error");
        setUpdateError(String(err));
      } else {
        setError(String(err));
      }
    }
  };

  const startWhisperDownload = async () => {
    try {
      setWhisperProgress({ status: "downloading", percent: 0 });
      await DownloadWhisperBinary();
      // whisper:binary-progress events atualizam o progresso via listener
    } catch (err) {
      setError(String(err));
    }
  };

  const unsubscribeRef = useRef<{
    progress?: () => void;
    complete?: () => void;
    whisperProgress?: () => void;
  }>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const registerListeners = async () => {
      try {
        if (isUpdateMode) {
          // Listeners for Application Update
          const unsubUpdate = await safeEventsOn<any>(
            "updater:progress",
            (data) => {
              if (!mountedRef.current) return;
              if (data.status === "downloading") {
                setUpdateStatus("downloading");
                setUpdateProgress(data.percent);
              } else if (data.status === "applying") {
                setUpdateStatus("applying");
                setUpdateProgress(100);
              } else if (data.status === "restarting") {
                setUpdateStatus("restarting");
                setUpdateProgress(100);
              } else if (data.status === "complete") {
                setUpdateStatus("complete");
              }
            },
          );
          unsubscribeRef.current.progress = unsubUpdate;
        } else {
          // Listeners for Dependency Setup
          const unsubProgress = await safeEventsOn<any>(
            "launcher:progress",
            (data) => {
              if (mountedRef.current) updateLauncherProgress(data);
            },
          );
          if (mountedRef.current)
            unsubscribeRef.current.progress = unsubProgress;
          else unsubProgress();

          const unsubComplete = await safeEventsOn<void>(
            "launcher:complete",
            () => {
              if (!mountedRef.current) return;
              if (needsWhisperRef.current) {
                // Deps padrão OK, agora baixar whisper
                needsWhisperRef.current = false;
                startWhisperDownload();
              } else {
                // Todas as deps instaladas com sucesso — agora é seguro persistir
                setEnabledFeatures(selectedFeatures);
                setComplete();
                setTimeout(() => {
                  if (mountedRef.current) navigate("/home");
                }, 1000);
              }
            },
          );
          if (mountedRef.current)
            unsubscribeRef.current.complete = unsubComplete;
          else unsubComplete();

          // Listener para progresso do whisper binary
          const unsubWhisper = await safeEventsOn<any>(
            "whisper:binary-progress",
            (data) => {
              if (!mountedRef.current) return;
              const percent = data.percent || 0;
              const status = data.status || "downloading";

              setWhisperProgress({ status, percent });

              // Atualizar o item "Whisper" no progress da launcher store
              updateLauncherProgress({
                name: "Whisper",
                downloaded: 0,
                total: 0,
                percent,
                status:
                  status === "complete"
                    ? "complete"
                    : status === "extracting"
                      ? "extracting"
                      : "downloading",
              });

              if (status === "complete") {
                // Whisper instalado com sucesso — agora é seguro persistir features
                setEnabledFeatures(selectedFeatures);
                setComplete();
                setTimeout(() => {
                  if (mountedRef.current) navigate("/home");
                }, 1000);
              }
            },
          );
          if (mountedRef.current)
            unsubscribeRef.current.whisperProgress = unsubWhisper;
          else unsubWhisper();
        }
      } catch (e) {
        console.warn("[Setup] Failed to register event listeners:", e);
      }
    };

    if (isPreview) {
      // Modo preview: popula dados mockados sem iniciar downloads
      reset();
      const mockDeps: any[] = [
        { name: "yt-dlp", installed: false },
        { name: "FFmpeg", installed: false },
      ];
      if (selectedFeatures.includes("transcriber")) {
        mockDeps.push({ name: "Whisper", installed: false });
      }
      setDependencies(mockDeps);
      return () => {
        mountedRef.current = false;
      };
    }

    // Só inicia download quando estiver no step de instalação (ou update mode)
    if (step !== "install" && !isUpdateMode) {
      return () => {
        mountedRef.current = false;
      };
    }

    registerListeners();
    startSetup();

    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current.progress) unsubscribeRef.current.progress();
      else {
        if (isUpdateMode) tryEventsOff("updater:progress");
        else tryEventsOff("launcher:progress");
      }

      if (unsubscribeRef.current.complete) unsubscribeRef.current.complete();
      else if (!isUpdateMode) tryEventsOff("launcher:complete");

      if (unsubscribeRef.current.whisperProgress)
        unsubscribeRef.current.whisperProgress();
      else if (!isUpdateMode) tryEventsOff("whisper:binary-progress");
    };
  }, [isUpdateMode, step]);

  const handleRetry = () => {
    setIsRetrying(true);
    startSetup();
  };

  const getOverallProgress = () => {
    if (dependencies.length === 0) return 0;
    const progressValues = Object.values(progress);
    if (progressValues.length === 0) return 0;
    const total = progressValues.reduce((acc, p) => acc + p.percent, 0);
    return total / dependencies.length;
  };

  const getStatusInfo = (dep: { name: string; installed: boolean }) => {
    if (dep.installed || progress[dep.name]?.status === "complete") {
      return {
        text: t("setup.status.installed"),
        icon: IconCheck,
        style: "text-surface-900 bg-surface-100 border-surface-200",
        iconStyle: "text-surface-900",
      };
    }

    const p = progress[dep.name];

    if (!p) {
      return {
        text: t("setup.status.waiting"),
        icon: IconPackage,
        style: "text-surface-400 bg-transparent border-transparent opacity-50",
        iconStyle: "text-surface-400",
      };
    }

    switch (p.status) {
      case "downloading":
        return {
          text: `${p.percent.toFixed(0)}%`,
          icon: IconDownload,
          style: "text-surface-900 bg-white border-surface-200 shadow-sm",
          iconStyle: "text-surface-900",
          animate: true,
        };
      case "extracting":
        return {
          text: t("setup.status.extracting"),
          icon: IconLoader2,
          style: "text-surface-900 bg-white border-surface-200 shadow-sm",
          iconStyle: "text-surface-900 animate-spin",
          spin: true,
        };
      case "verifying":
        return {
          text: t("setup.status.verifying"),
          icon: IconLoader2,
          style: "text-surface-900 bg-white border-surface-200 shadow-sm",
          iconStyle: "text-surface-900 animate-spin",
          spin: true,
        };
      case "error":
        return {
          text: t("setup.status.error"),
          icon: IconX,
          style: "text-red-600 bg-red-50 border-red-100",
          iconStyle: "text-red-600",
        };
      default:
        return {
          text: t("setup.status.waiting"),
          icon: IconPackage,
          style: "text-surface-400 opacity-50",
          iconStyle: "text-surface-400",
        };
    }
  };

  const overallProgress = isUpdateMode ? updateProgress : getOverallProgress();

  // Adapter para renderizar UI unificada
  const displayItems = isUpdateMode
    ? [{ name: "Application Update", status: updateStatus }]
    : dependencies;

  const getStatusInfoUpdateWrapper = (item: any) => {
    if (isUpdateMode) {
      // Logic for generic update item
      switch (item.status) {
        case "downloading":
          return {
            text: `${updateProgress.toFixed(0)}%`,
            icon: IconDownload,
            style: "text-surface-900 bg-white border-surface-200 shadow-sm",
            iconStyle: "text-surface-900",
            animate: true,
          };
        case "applying":
          return {
            text: "Instalando...",
            icon: IconLoader2,
            style: "text-surface-900 bg-white border-surface-200 shadow-sm",
            iconStyle: "text-surface-900 animate-spin",
            spin: true,
          };
        case "restarting":
          return {
            text: "Reiniciando...",
            icon: IconLoader2,
            style: "text-surface-900 bg-white border-surface-200 shadow-sm",
            iconStyle: "text-surface-900 animate-spin",
            spin: true,
          };
        case "complete":
          return {
            text: "Concluído",
            icon: IconCheck,
            style: "text-green-900 bg-green-100 border-green-200",
            iconStyle: "text-green-700",
          };
        case "error":
          return {
            text: "Erro",
            icon: IconX,
            style: "text-red-900 bg-red-100 border-red-200",
            iconStyle: "text-red-700",
          };
        default:
          return {
            text: "Aguardando",
            icon: IconPackage,
            style: "text-surface-400 opacity-50",
            iconStyle: "text-surface-400",
          };
      }
    }
    return getStatusInfo(item);
  };

  // Feature Selection Step
  if (
    (step === "features" && !isUpdateMode) ||
    (isPreview && step === "features")
  ) {
    return (
      <div className="min-h-screen bg-white text-surface-900 flex flex-col items-center justify-center p-8 selection:bg-surface-900 selection:text-white">
        {/* Header */}
        <div className="w-full max-w-4xl text-center mb-16 space-y-4">
          <motion.h1
            className="font-black uppercase text-surface-950"
            style={{
              fontSize: "150px",
              lineHeight: "1.1",
              letterSpacing: "-4px",
              filter: "drop-shadow(rgba(0, 0, 0, 0.15) 0px 25px 25px)",
            }}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            DOWNKINGO
          </motion.h1>

          <motion.div
            className="flex items-center justify-center gap-2 text-surface-500 font-medium tracking-wide text-sm uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {t("setup.features.title")}
          </motion.div>
        </div>

        {/* Feature Cards */}
        <motion.div
          className="w-full max-w-xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="grid grid-cols-2 gap-3 mb-8">
            {ALL_FEATURE_IDS.map((id) => {
              const meta = FEATURE_REGISTRY[id];
              const Icon = meta.icon;
              const isSelected = selectedFeatures.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleLocalFeature(id)}
                  className={`
                    group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200
                    ${
                      isSelected
                        ? "border-surface-900 bg-surface-50 shadow-sm"
                        : "border-surface-200 bg-white hover:border-surface-300"
                    }
                  `}
                >
                  {/* Check indicator */}
                  <div
                    className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? "border-surface-900 bg-surface-900"
                        : "border-surface-300"
                    }`}
                  >
                    {isSelected && (
                      <IconCheck size={12} className="text-white" stroke={3} />
                    )}
                  </div>

                  <Icon
                    size={28}
                    className={`transition-colors ${
                      isSelected ? "text-surface-900" : "text-surface-400"
                    }`}
                    stroke={1.5}
                  />
                  <div className="text-center">
                    <p
                      className={`text-sm font-bold tracking-tight ${
                        isSelected ? "text-surface-900" : "text-surface-500"
                      }`}
                    >
                      {t(`setup.features.${id}`)}
                    </p>
                    <p className="text-xs text-surface-400 mt-1">
                      {t(`setup.features.${id}_desc`)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleContinueFeatures}
            className="w-full py-3 bg-surface-900 text-white font-bold text-sm uppercase tracking-wider rounded-lg hover:bg-surface-800 transition-colors"
          >
            {t("setup.features.continue")}
          </button>
        </motion.div>

        {/* Footer */}
        <motion.div
          className="fixed bottom-8 text-surface-300 text-xs font-medium uppercase tracking-widest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Open Source Downloader
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-surface-900 flex flex-col items-center justify-center p-8 selection:bg-surface-900 selection:text-white">
      {/* Header - Area Ampla */}
      <div className="w-full max-w-4xl text-center mb-20 space-y-4">
        <motion.h1
          className="font-black uppercase text-surface-950"
          style={{
            fontSize: "150px",
            lineHeight: "1.1",
            letterSpacing: "-4px",
            filter: "drop-shadow(rgba(0, 0, 0, 0.15) 0px 25px 25px)",
          }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          DOWNKINGO
        </motion.h1>

        <motion.div
          className="flex items-center justify-center gap-2 text-surface-500 font-medium tracking-wide text-sm uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-2 h-2 rounded-full bg-surface-300 animate-pulse" />
          {t("setup.title")}
        </motion.div>
      </div>

      {/* Content Wrapper - Apenas para Card e Status */}
      <div className="w-full max-w-xl flex flex-col gap-12">
        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-col gap-6"
        >
          {/* Overall Progress */}
          <div className="relative pt-2">
            <div className="flex justify-between items-end mb-2 px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-surface-400">
                Installation
              </span>
              <span className="text-4xl font-black tracking-tight tabular-nums leading-none">
                {overallProgress.toFixed(0)}%
              </span>
            </div>

            <div className="h-1 w-full bg-surface-100 overflow-hidden">
              <motion.div
                className="h-full bg-surface-950"
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ ease: "easeInOut" }}
              />
            </div>
          </div>

          {/* Steps List */}
          <div className="grid gap-3">
            <AnimatePresence mode="popLayout">
              {displayItems.map((dep, index) => {
                const status = getStatusInfoUpdateWrapper(dep);
                const Icon = status.icon;

                const percent = isUpdateMode
                  ? updateProgress
                  : progress[dep.name]?.percent || 0;

                return (
                  <motion.div
                    key={dep.name}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                    className={`
                                    group relative flex items-center justify-between p-4 rounded-lg border overflow-hidden
                                    transition-colors duration-200
                                    ${status.style}
                                `}
                  >
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-neutral-200"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${percent}%`,
                      }}
                      transition={{ ease: "linear", duration: 0.2 }}
                      style={{ zIndex: 0 }}
                    />

                    <div
                      className="flex items-center gap-4 relative"
                      style={{ zIndex: 1 }}
                    >
                      <Icon
                        size={20}
                        className={`${status.iconStyle} transition-transform group-hover:scale-110`}
                        stroke={2}
                      />
                      <span className="font-bold tracking-tight text-sm uppercase">
                        {dep.name}
                      </span>
                    </div>

                    <span
                      className={`relative text-xs font-semibold uppercase tracking-wider opacity-80 ${status.iconStyle}`}
                      style={{ zIndex: 1 }}
                    >
                      {status.text}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {(error || updateError) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-700 text-sm">
                  <p className="font-bold mb-1">
                    {t("setup.installation_error")}
                  </p>
                  <p className="opacity-80">{error || updateError}</p>

                  <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="mt-3 text-xs font-bold uppercase tracking-wider underline hover:text-red-900 disabled:opacity-50"
                  >
                    {isRetrying ? t("setup.retrying") : t("setup.retry")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        className="fixed bottom-8 text-surface-300 text-xs font-medium uppercase tracking-widest"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Open Source Downloader
      </motion.div>
    </div>
  );
}
