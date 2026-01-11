import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useLauncherStore } from "../stores/launcherStore";
import { useTranslation } from "react-i18next";
import {
  CheckDependencies,
  DownloadDependencies,
} from "../../wailsjs/go/main/App";
import { safeEventsOn, tryEventsOff } from "../lib/wailsRuntime";
import {
  IconCheck,
  IconX,
  IconLoader2,
  IconDownload,
  IconPackage,
} from "@tabler/icons-react";

export default function Setup() {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const [isRetrying, setIsRetrying] = useState(false);
  const {
    dependencies,
    progress,
    isComplete,
    error,
    setDependencies,
    updateProgress,
    setComplete,
    setError,
    reset,
  } = useLauncherStore();

  const startSetup = async () => {
    try {
      reset();
      setIsRetrying(false);

      const deps = await CheckDependencies();
      setDependencies(deps);

      if (deps.every((d: { installed: boolean }) => d.installed)) {
        navigate("/home");
        return;
      }

      await DownloadDependencies();
    } catch (err) {
      setError(String(err));
    }
  };

  const unsubscribeRef = useRef<{
    progress?: () => void;
    complete?: () => void;
  }>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const registerListeners = async () => {
      try {
        const unsubProgress = await safeEventsOn<any>(
          "launcher:progress",
          (data) => {
            if (mountedRef.current) updateProgress(data);
          }
        );
        if (mountedRef.current) unsubscribeRef.current.progress = unsubProgress;
        else unsubProgress();

        const unsubComplete = await safeEventsOn<void>(
          "launcher:complete",
          () => {
            if (mountedRef.current) {
              setComplete();
              setTimeout(() => {
                if (mountedRef.current) navigate("/home");
              }, 1000);
            }
          }
        );
        if (mountedRef.current) unsubscribeRef.current.complete = unsubComplete;
        else unsubComplete();
      } catch (e) {
        console.warn("[Setup] Failed to register event listeners:", e);
      }
    };

    registerListeners();
    startSetup();

    return () => {
      mountedRef.current = false;
      if (unsubscribeRef.current.progress) unsubscribeRef.current.progress();
      else tryEventsOff("launcher:progress");
      if (unsubscribeRef.current.complete) unsubscribeRef.current.complete();
      else tryEventsOff("launcher:complete");
    };
  }, []);

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

  const overallProgress = getOverallProgress();

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
              {dependencies.map((dep, index) => {
                const status = getStatusInfo(dep);
                const Icon = status.icon;

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
                    {/* Background Progress Bar */}
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-neutral-200"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${progress[dep.name]?.percent || 0}%`,
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
            {error && (
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
                  <p className="opacity-80">{error}</p>

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
