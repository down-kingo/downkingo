import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useLauncherStore } from "../stores/launcherStore";
import {
  CheckDependencies,
  DownloadDependencies,
} from "../../wailsjs/go/main/App";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";

export default function Setup() {
  const navigate = useNavigate();
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

      // If all installed, skip to home
      if (deps.every((d: { installed: boolean }) => d.installed)) {
        navigate("/home");
        return;
      }

      // Start downloading
      await DownloadDependencies();
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => {
    // Listen for progress events
    EventsOn("launcher:progress", (data: any) => {
      updateProgress(data);
    });

    EventsOn("launcher:complete", () => {
      setComplete();
      setTimeout(() => navigate("/home"), 1500);
    });

    startSetup();

    return () => {
      EventsOff("launcher:progress");
      EventsOff("launcher:complete");
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

  const getStatusText = (dep: { name: string; installed: boolean }) => {
    if (dep.installed) return "Instalado";
    const p = progress[dep.name];
    if (!p) return "Aguardando...";

    switch (p.status) {
      case "downloading":
        return `Baixando... ${p.percent.toFixed(0)}%`;
      case "extracting":
        return "Extraindo...";
      case "verifying":
        return "Verificando...";
      case "complete":
        return "Concluído";
      case "error":
        return "Erro";
      default:
        return "Aguardando...";
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="text-center mb-12">
          <motion.h1
            className="font-display text-4xl font-bold text-surface-900 mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Kinematic
          </motion.h1>
          <motion.p
            className="text-surface-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Preparando componentes essenciais...
          </motion.p>
        </div>

        {/* Progress Card */}
        <motion.div
          className="card p-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          {/* Overall Progress */}
          <div className="mb-8">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-surface-600">Progresso geral</span>
              <span className="font-medium text-surface-900">
                {getOverallProgress().toFixed(0)}%
              </span>
            </div>
            <div className="progress-bar">
              <motion.div
                className="progress-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${getOverallProgress()}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Dependencies List */}
          <div className="space-y-4">
            {dependencies.map((dep, index) => (
              <motion.div
                key={dep.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-center justify-between p-4 bg-surface-50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      dep.installed || progress[dep.name]?.status === "complete"
                        ? "bg-green-500"
                        : progress[dep.name]?.status === "error"
                        ? "bg-red-500"
                        : "bg-primary-600 animate-pulse"
                    }`}
                  />
                  <span className="font-medium text-surface-900">
                    {dep.name}
                  </span>
                </div>
                <span className="text-sm text-surface-600">
                  {getStatusText(dep)}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Error State with Retry Button */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6"
              >
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
                  <p className="text-red-700 text-sm font-medium mb-1">
                    Erro na instalação
                  </p>
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {isRetrying ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Tentando novamente...
                    </span>
                  ) : (
                    "Tentar Novamente"
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Complete State */}
          <AnimatePresence>
            {isComplete && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </motion.div>
                <p className="text-surface-600">
                  Tudo pronto! Redirecionando...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}
