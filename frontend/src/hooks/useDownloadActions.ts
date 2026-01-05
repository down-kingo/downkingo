import { useCallback } from "react";
import {
  GetDownloadQueue,
  GetDownloadHistory,
  AddToQueue,
  AddToQueueAdvanced,
  CancelDownload,
  ClearDownloadHistory,
} from "../../wailsjs/go/main/App";
import { youtube } from "../../wailsjs/go/models";
import { useDownloadStore, Download } from "../stores/downloadStore";

/**
 * Hook para ações de download (API calls).
 * Responsabilidade única: interface com o backend Go.
 *
 * @internal Usado internamente por useDownloadSync
 */
export function useDownloadActions() {
  const { setQueue, setHistory, setLoading, setError } = useDownloadStore();

  /**
   * Carrega fila e histórico do backend.
   */
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [queue, history] = await Promise.all([
        GetDownloadQueue(),
        GetDownloadHistory(50),
      ]);
      setQueue((queue as Download[]) || []);
      setHistory((history as Download[]) || []);
    } catch (err) {
      console.error("[useDownloadActions] Failed to load initial data:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [setQueue, setHistory, setLoading, setError]);

  /**
   * Adiciona um download à fila (simples).
   */
  const addToQueue = useCallback(
    async (url: string, format = "best", audioOnly = false) => {
      try {
        setError(null);
        const download = await AddToQueue(url, format, audioOnly);
        return download as Download;
      } catch (err) {
        console.error("[useDownloadActions] Failed to add to queue:", err);
        setError(String(err));
        throw err;
      }
    },
    [setError]
  );

  /**
   * Adiciona um download à fila (avançado com todas as opções).
   */
  const addToQueueAdvanced = useCallback(
    async (opts: youtube.DownloadOptions) => {
      try {
        setError(null);
        const download = await AddToQueueAdvanced(opts);
        return download as Download;
      } catch (err) {
        console.error("[useDownloadActions] Failed to add to queue:", err);
        setError(String(err));
        throw err;
      }
    },
    [setError]
  );

  /**
   * Cancela um download em andamento.
   */
  const cancelDownload = useCallback(
    async (id: string) => {
      try {
        await CancelDownload(id);
      } catch (err) {
        console.error("[useDownloadActions] Failed to cancel download:", err);
        setError(String(err));
      }
    },
    [setError]
  );

  /**
   * Recarrega dados do backend.
   */
  const refresh = useCallback(() => {
    loadInitialData();
  }, [loadInitialData]);

  /**
   * Limpa o histórico de downloads.
   */
  const clearHistory = useCallback(async () => {
    try {
      await ClearDownloadHistory();
      setHistory([]);
    } catch (err) {
      console.error("[useDownloadActions] Failed to clear history:", err);
      setError(String(err));
    }
  }, [setHistory, setError]);

  return {
    loadInitialData,
    addToQueue,
    addToQueueAdvanced,
    cancelDownload,
    refresh,
    clearHistory,
  };
}
