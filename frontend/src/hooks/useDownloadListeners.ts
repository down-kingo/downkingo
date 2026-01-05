import { useEffect, useRef } from "react";
import { safeEventsOn, tryEventsOff } from "../lib/wailsRuntime";
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
  const { addDownload, updateDownload, completeDownload } = useDownloadStore();

  const unsubscribeRef = useRef<{ added?: () => void; progress?: () => void }>(
    {}
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    console.log("[useDownloadListeners] Setting up event listeners");

    const registerListeners = async () => {
      try {
        // Listener: novo download adicionado
        const unsubAdded = await safeEventsOn<Download>(
          "download:added",
          (download) => {
            if (mountedRef.current) {
              console.log("[useDownloadListeners] download:added", download);
              addDownload(download);
            }
          }
        );
        if (mountedRef.current) {
          unsubscribeRef.current.added = unsubAdded;
        } else {
          unsubAdded();
        }

        // Listener: progresso do download
        const unsubProgress = await safeEventsOn<DownloadProgress>(
          "download:progress",
          (progress) => {
            if (mountedRef.current) {
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
                setTimeout(() => {
                  if (mountedRef.current) {
                    completeDownload(progress.id);
                  }
                }, 1500);
              }
            }
          }
        );
        if (mountedRef.current) {
          unsubscribeRef.current.progress = unsubProgress;
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
      mountedRef.current = false;
      console.log("[useDownloadListeners] Cleaning up event listeners");
      if (unsubscribeRef.current.added) {
        unsubscribeRef.current.added();
      } else {
        tryEventsOff("download:added");
      }
      if (unsubscribeRef.current.progress) {
        unsubscribeRef.current.progress();
      } else {
        tryEventsOff("download:progress");
      }
    };
  }, [addDownload, updateDownload, completeDownload]);
}
