import { useEffect } from "react";
import { safeEventsOn } from "../lib/wailsRuntime";
import {
  useDownloadStore,
  Download,
  DownloadProgress,
} from "../stores/downloadStore";

/**
 * Hook para escutar eventos do backend e atualizar o store.
 * Responsabilidade única: gerenciar listeners de eventos Wails.
 *
 * @internal Usado internamente por useDownloadSync
 */
export function useDownloadListeners() {
  const addDownload = useDownloadStore((state) => state.addDownload);
  const updateDownload = useDownloadStore((state) => state.updateDownload);
  const completeDownload = useDownloadStore((state) => state.completeDownload);

  useEffect(() => {
    let mounted = true;
    const unsubscribers: { added?: () => void; progress?: () => void } = {};
    const completionTimers = new Map<
      string,
      ReturnType<typeof setTimeout>
    >();
    console.log("[useDownloadListeners] Setting up event listeners");

    const registerListeners = async () => {
      try {
        // Listener: novo download adicionado
        const unsubAdded = await safeEventsOn<Download>(
          "download:added",
          (download) => {
            if (mounted) {
              console.log("[useDownloadListeners] download:added", download);
              addDownload(download);
            }
          }
        );
        if (mounted) {
          unsubscribers.added = unsubAdded;
        } else {
          unsubAdded();
        }

        // Listener: progresso do download
        const unsubProgress = await safeEventsOn<DownloadProgress>(
          "download:progress",
          (progress) => {
            if (mounted) {
              console.log("[useDownloadListeners] download:progress", progress);

              updateDownload(progress.id, {
                status: progress.status,
                progress: progress.progress,
                speed: progress.speed,
                eta: progress.eta,
                title: progress.title || undefined,
                thumbnail: progress.thumbnail || undefined,
              });

              // Se completou, falhou ou cancelou, mover para histórico
              if (
                progress.status === "completed" ||
                progress.status === "failed" ||
                progress.status === "cancelled"
              ) {
                const existingTimer = completionTimers.get(progress.id);
                if (existingTimer) clearTimeout(existingTimer);

                const timer = setTimeout(() => {
                  completionTimers.delete(progress.id);
                  if (mounted) {
                    completeDownload(progress.id);
                  }
                }, 1500);
                completionTimers.set(progress.id, timer);
              }
            }
          }
        );
        if (mounted) {
          unsubscribers.progress = unsubProgress;
        } else {
          unsubProgress();
        }
      } catch (e) {
        console.warn(
          "[useDownloadListeners] Failed to register event listeners:",
          e
        );
      }
    };

    registerListeners();

    // Cleanup
    return () => {
      mounted = false;
      for (const timer of completionTimers.values()) {
        clearTimeout(timer);
      }
      completionTimers.clear();
      console.log("[useDownloadListeners] Cleaning up event listeners");
      if (unsubscribers.added) {
        unsubscribers.added();
      }
      if (unsubscribers.progress) {
        unsubscribers.progress();
      }
    };
  }, [addDownload, updateDownload, completeDownload]);
}
