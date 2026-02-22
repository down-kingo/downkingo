import { useState, useRef, useCallback } from "react";
import { GetStreamURL, SetStreamURL } from "../../bindings/kingo/app";
import type { VideoInfo } from "./useVideoFetch";

/**
 * Hook that manages video trimmer state: stream loading, blob upgrade, trim times.
 * Kept isolated to prevent trimmer state changes from re-rendering the entire Video page.
 */
export function useTrimmer(videoInfo: VideoInfo | null, url: string) {
  const [trimEnabled, setTrimEnabled] = useState(false);
  const [trimStart, setTrimStart] = useState("");
  const [trimEnd, setTrimEnd] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const streamFallbackTriedRef = useRef(false);
  const blobAbortRef = useRef<AbortController | null>(null);

  // Find best muxed (video+audio) format URL for preview.
  // Prefers small (360p) MP4 — preview doesn't need HD.
  const findBestMuxedUrl = useCallback((): string | null => {
    if (!videoInfo?.formats) return null;
    const muxed = videoInfo.formats.filter(
      (f) =>
        f.url &&
        f.vcodec &&
        f.vcodec !== "none" &&
        f.acodec &&
        f.acodec !== "none",
    );
    if (muxed.length === 0) return null;

    const mp4s = muxed
      .filter((f) => f.ext === "mp4")
      .sort((a, b) => (a.height || 0) - (b.height || 0));
    const best = mp4s.find((f) => (f.height || 0) >= 240) || mp4s[0];
    return best?.url || muxed[0]?.url || null;
  }, [videoInfo]);

  // Phase 1: Show video via proxy (instant streaming)
  // Phase 2: Download blob in background, swap src when ready (instant seeking)
  const handleTrimToggle = useCallback(
    async (enabled: boolean) => {
      setTrimEnabled(enabled);
      streamFallbackTriedRef.current = false;

      // Abort any pending blob download
      blobAbortRef.current?.abort();
      blobAbortRef.current = null;

      if (enabled && url && !streamUrl) {
        // Phase 1: stream via proxy — video appears immediately
        const muxedUrl = findBestMuxedUrl();
        if (muxedUrl) {
          try {
            const proxyUrl = await SetStreamURL(muxedUrl);
            setStreamUrl(proxyUrl);

            // Phase 2: download blob in background for instant seeking
            const controller = new AbortController();
            blobAbortRef.current = controller;
            fetch(proxyUrl, { signal: controller.signal })
              .then((r) => (r.ok ? r.blob() : Promise.reject()))
              .then((blob) => {
                if (!controller.signal.aborted) {
                  const blobUrl = URL.createObjectURL(blob);
                  setStreamUrl(blobUrl);
                }
              })
              .catch(() => {});
            return;
          } catch {
            // Fall through to yt-dlp
          }
        }

        // Fallback: yt-dlp extraction → proxy stream → blob upgrade
        setIsLoadingStream(true);
        try {
          const proxyUrl = await GetStreamURL(url, "best[ext=mp4]/best");
          setStreamUrl(proxyUrl);

          const controller = new AbortController();
          blobAbortRef.current = controller;
          fetch(proxyUrl, { signal: controller.signal })
            .then((r) => (r.ok ? r.blob() : Promise.reject()))
            .then((blob) => {
              if (!controller.signal.aborted) {
                setStreamUrl(URL.createObjectURL(blob));
              }
            })
            .catch(() => {});
        } catch {
          setStreamUrl("");
        } finally {
          setIsLoadingStream(false);
        }
      }
    },
    [url, streamUrl, findBestMuxedUrl],
  );

  // Called by VideoTrimmer when the video fails to load — retry with full yt-dlp
  const handleStreamError = useCallback(async () => {
    if (streamFallbackTriedRef.current || !url) return;
    streamFallbackTriedRef.current = true;

    if (streamUrl.startsWith("blob:")) URL.revokeObjectURL(streamUrl);
    blobAbortRef.current?.abort();

    setIsLoadingStream(true);
    try {
      const proxyUrl = await GetStreamURL(url, "best[ext=mp4]/best");
      setStreamUrl(proxyUrl);
    } catch {
      setStreamUrl("");
    } finally {
      setIsLoadingStream(false);
    }
  }, [url, streamUrl]);

  const handleTrimChange = useCallback((start: string, end: string) => {
    setTrimStart(start);
    setTrimEnd(end);
  }, []);

  const resetTrimmer = useCallback(() => {
    setTrimEnabled(false);
    setTrimStart("");
    setTrimEnd("");
    blobAbortRef.current?.abort();
    blobAbortRef.current = null;
    if (streamUrl.startsWith("blob:")) URL.revokeObjectURL(streamUrl);
    setStreamUrl("");
    streamFallbackTriedRef.current = false;
  }, [streamUrl]);

  return {
    trimEnabled,
    trimStart,
    trimEnd,
    streamUrl,
    isLoadingStream,
    handleTrimToggle,
    handleStreamError,
    handleTrimChange,
    resetTrimmer,
  };
}
