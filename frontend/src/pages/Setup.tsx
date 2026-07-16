import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useLauncherStore } from "../stores/launcherStore";
import { useSettingsStore, FeatureId } from "../stores/settingsStore";
import { useTranslation } from "react-i18next";
import {
  CheckDependencies,
  DownloadSelectedDependencies,
  DownloadAndApplyUpdate,
  IsWhisperInstalled,
  DownloadWhisperBinary,
  OpenUrl,
} from "../../bindings/kingo/app";
import { safeEventsOn } from "../lib/wailsRuntime";
import {
  FEATURE_REGISTRY,
  ALL_FEATURE_IDS,
  getRequiredDependencyNames,
} from "../lib/features";
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

  // Variáveis CSS light mode forçadas — imune ao dark mode global
  const lightVars: React.CSSProperties = {
    "--surface-50": "#ffffff",
    "--surface-100": "#fafafa",
    "--surface-200": "#e4e4e7",
    "--surface-300": "#d4d4d8",
    "--surface-400": "#a1a1aa",
    "--surface-500": "#71717a",
    "--surface-600": "#52525b",
    "--surface-700": "#3f3f46",
    "--surface-800": "#27272a",
    "--surface-900": "#18181b",
  } as React.CSSProperties;

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
  const requiredDepNames = useMemo(
    () => getRequiredDependencyNames(selectedFeatures),
    [selectedFeatures],
  );

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
    error,
    setDependencies,
    updateProgress: updateLauncherProgress,
    setError,
    reset,
  } = useLauncherStore();

  // Track whisper download progress separately
  const [, setWhisperProgress] = useState<{
    status: string;
    percent: number;
  } | null>(null);
  const needsWhisperRef = useRef(false);

  const startWhisperDownload = useCallback(async () => {
    try {
      setWhisperProgress({ status: "downloading", percent: 0 });
      await DownloadWhisperBinary();
      // whisper:binary-progress events atualizam o progresso via listener
    } catch (err) {
      setError(String(err));
    }
  }, [setError]);

  const startSetup = useCallback(async () => {
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
            version: "v1.9.1",
            license: "MIT",
            projectUrl: "https://github.com/ggml-org/whisper.cpp",
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
  }, [
    isUpdateMode,
    navigate,
    requiredDepNames,
    reset,
    selectedFeatures,
    setDependencies,
    setEnabledFeatures,
    setError,
    startWhisperDownload,
    updateUrl,
  ]);

  const mountedRef = useRef(true);
  const listenerRunRef = useRef(0);

  useEffect(() => {
    const runID = ++listenerRunRef.current;
    const unsubscribers: {
      progress?: () => void;
      complete?: () => void;
      whisperProgress?: () => void;
    } = {};
    const isActive = () =>
      mountedRef.current && listenerRunRef.current === runID;
    mountedRef.current = true;

    const registerListeners = async () => {
      try {
        if (isUpdateMode) {
          // Listeners for Application Update
          const unsubUpdate = await safeEventsOn<any>(
            "updater:progress",
            (data) => {
              if (!isActive()) return;
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
          if (isActive()) unsubscribers.progress = unsubUpdate;
          else unsubUpdate();
        } else {
          // Listeners for Dependency Setup
          const unsubProgress = await safeEventsOn<any>(
            "launcher:progress",
            (data) => {
              if (isActive()) updateLauncherProgress(data);
            },
          );
          if (isActive()) unsubscribers.progress = unsubProgress;
          else unsubProgress();

          const unsubComplete = await safeEventsOn<void>(
            "launcher:complete",
            () => {
              if (!isActive()) return;
              if (needsWhisperRef.current) {
                // Deps padrão OK, agora baixar whisper
                needsWhisperRef.current = false;
                startWhisperDownload();
              } else {
                // Todas as deps instaladas com sucesso — agora é seguro persistir
                setEnabledFeatures(selectedFeatures);
                setTimeout(() => {
                  if (isActive()) navigate("/home");
                }, 1000);
              }
            },
          );
          if (isActive()) unsubscribers.complete = unsubComplete;
          else unsubComplete();

          // Listener para progresso do whisper binary
          const unsubWhisper = await safeEventsOn<any>(
            "whisper:binary-progress",
            (data) => {
              if (!isActive()) return;
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
                setTimeout(() => {
                  if (isActive()) navigate("/home");
                }, 1000);
              }
            },
          );
          if (isActive()) unsubscribers.whisperProgress = unsubWhisper;
          else unsubWhisper();
        }
      } catch (e) {
        console.warn("[Setup] Failed to register event listeners:", e);
      }
    };

    if (isPreview) {
      // Modo preview: popula dados mockados sem iniciar downloads
      reset();
      const mockCatalog: any[] = [
        {
          name: "yt-dlp",
          installed: false,
          version: "latest",
          license: "Unlicense",
          projectUrl: "https://github.com/yt-dlp/yt-dlp",
        },
        {
          name: "FFmpeg",
          installed: false,
          version: "latest",
          license: "GPL-3.0",
          projectUrl: "https://ffmpeg.org/",
        },
        {
          name: "YouTube PO Provider",
          installed: false,
          version: "v0.8.1",
          license: "GPL-3.0",
          projectUrl:
            "https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs",
        },
        {
          name: "yt-dlp PO Plugin",
          installed: false,
          version: "v0.8.1",
          license: "GPL-3.0",
          projectUrl:
            "https://github.com/jim60105/bgutil-ytdlp-pot-provider-rs",
        },
      ];
      const mockDeps = mockCatalog.filter((dependency) =>
        requiredDepNames.includes(dependency.name),
      );
      if (selectedFeatures.includes("transcriber")) {
        mockDeps.push({
          name: "Whisper",
          installed: false,
          version: "v1.9.1",
          license: "MIT",
          projectUrl: "https://github.com/ggml-org/whisper.cpp",
        });
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
      unsubscribers.progress?.();
      unsubscribers.complete?.();
      unsubscribers.whisperProgress?.();
    };
  }, [
    isPreview,
    isUpdateMode,
    navigate,
    requiredDepNames,
    reset,
    selectedFeatures,
    setDependencies,
    setEnabledFeatures,
    startSetup,
    startWhisperDownload,
    step,
    updateLauncherProgress,
  ]);

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
      <div style={lightVars} className="min-h-screen bg-white text-surface-900 flex flex-col items-center justify-center p-8 selection:bg-surface-900 selection:text-white">
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
    <div
      style={lightVars}
      className="min-h-screen bg-white text-surface-900 flex flex-col items-center justify-center p-8 selection:bg-surface-900 selection:text-white"
    >
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
                const component = "installed" in dep ? dep : null;

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
                      className="flex min-w-0 items-center gap-4 relative"
                      style={{ zIndex: 1 }}
                    >
                      <Icon
                        size={20}
                        className={`${status.iconStyle} transition-transform group-hover:scale-110`}
                        stroke={2}
                      />
                      <div className="min-w-0">
                        <span className="block truncate font-bold tracking-tight text-sm uppercase">
                          {dep.name}
                        </span>
                        {(component?.version ||
                          component?.license ||
                          component?.projectUrl) && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] font-semibold uppercase tracking-wider text-surface-500">
                            {component.version && <span>{component.version}</span>}
                            {component.license && <span>{component.license}</span>}
                            {component.projectUrl && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (component.projectUrl) {
                                    OpenUrl(component.projectUrl);
                                  }
                                }}
                                className="underline decoration-surface-300 underline-offset-2 transition-colors hover:text-surface-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-500"
                              >
                                {t("setup.source_code")}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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
