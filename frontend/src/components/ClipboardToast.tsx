import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconClipboard, IconDownload, IconX } from "@tabler/icons-react";
import { safeEventsOn } from "../lib/wailsRuntime";

export default function ClipboardToast() {
  const [url, setUrl] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const autoHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    let cancelSubscription: (() => void) | undefined;

    const setup = async () => {
      console.log("[ClipboardToast] Registering listener...");
      const unsubscribe = await safeEventsOn(
        "clipboard:link-detected",
        (detectedUrl: any) => {
          console.log("[ClipboardToast] Event received:", detectedUrl);
          if (mountedRef.current && typeof detectedUrl === "string") {
            setUrl(detectedUrl);

            // Clear existing timeout if any
            if (autoHideTimeoutRef.current) {
              clearTimeout(autoHideTimeoutRef.current);
            }
          }
        }
      );

      if (mountedRef.current) {
        cancelSubscription = unsubscribe;
      } else {
        unsubscribe(); // Cleanup if unmounted during await
      }
    };

    setup();

    return () => {
      mountedRef.current = false;
      if (cancelSubscription) {
        cancelSubscription();
      }
      if (autoHideTimeoutRef.current) {
        clearTimeout(autoHideTimeoutRef.current);
      }
    };
  }, []);

  const handleDownload = () => {
    if (url) {
      // Dispatch local custom event for Home.tsx to listen
      window.dispatchEvent(
        new CustomEvent("kinematic:fill-url", { detail: url })
      );

      // Hide the toast
      setUrl(null);
    }
  };

  const handleDismiss = () => {
    setUrl(null);
  };

  // If no URL, return null (don't render anything in single window mode)
  if (!url) return null;

  return (
    <AnimatePresence>
      {url && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-4 right-4 z-50 pointer-events-auto"
        >
          <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl p-4 border border-primary-500/20 ring-1 ring-black/5 dark:ring-white/10 flex items-start gap-4 max-w-sm w-full">
            <div className="bg-primary-100 dark:bg-primary-900/30 p-2.5 rounded-lg text-primary-600 dark:text-primary-400 shrink-0">
              <IconClipboard size={24} />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-surface-900 dark:text-white mb-1">
                Link Detectado
              </h4>
              <p className="text-xs text-surface-500 dark:text-surface-400 truncate mb-3 font-mono bg-surface-50 dark:bg-surface-900 rounded px-2 py-1">
                {url}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <IconDownload size={14} />
                  Baixar Agora
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-3 py-2 bg-surface-100 hover:bg-surface-200 dark:bg-surface-700 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 rounded-lg text-xs font-medium transition-colors"
                >
                  Dispensar
                </button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
            >
              <IconX size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
