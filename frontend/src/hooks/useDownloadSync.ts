import { useEffect } from "react";
import { useDownloadListeners } from "./useDownloadListeners";
import { useDownloadActions } from "./useDownloadActions";

/**
 * Hook para sincronizar o estado do frontend com o backend.
 * Compõe useDownloadListeners e useDownloadActions.
 *
 * Arquitetura:
 * - useDownloadListeners: Gerencia eventos Wails (download:added, download:progress)
 * - useDownloadActions: Gerencia chamadas API (AddToQueue, CancelDownload, etc)
 * - useDownloadSync: Orquestra ambos e expõe uma API unificada
 *
 * @example
 * ```tsx
 * function DownloadPage() {
 *   const { addToQueue, cancelDownload, refresh } = useDownloadSync();
 *
 *   const handleDownload = async () => {
 *     await addToQueue("https://youtube.com/...", "720p");
 *   };
 *
 *   return <button onClick={handleDownload}>Download</button>;
 * }
 * ```
 */
export function useDownloadSync() {
  // Setup event listeners (side effect)
  useDownloadListeners();

  // Get action functions
  const {
    loadInitialData,
    addToQueue,
    addToQueueAdvanced,
    cancelDownload,
    refresh,
    clearHistory,
  } = useDownloadActions();

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Expose actions to consumers
  return {
    addToQueue,
    addToQueueAdvanced,
    cancelDownload,
    refresh,
    clearHistory,
  };
}
