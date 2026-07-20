import { useState, useRef, useCallback, useEffect } from "react";
import { GetStreamURL, SetStreamURL } from "../../bindings/kingo/app";
import type { VideoInfo } from "./useVideoFetch";
import type { CutRange } from "../components/video/VideoTrimmer";
import {
  createDefaultCaptionOptions,
  type CaptionOptions,
} from "../components/video/captions";

/**
 * Hook that manages video trimmer state: stream loading and trim times.
 * Kept isolated to prevent trimmer state changes from re-rendering the entire Video page.
 */
export function useTrimmer(videoInfo: VideoInfo | null, url: string) {
  const [trimEnabled, setTrimEnabled] = useState(false);
  const [cutRanges, setCutRanges] = useState<CutRange[]>([]);
  const [captions, setCaptions] = useState<CaptionOptions>(() =>
    createDefaultCaptionOptions(),
  );
  const [streamUrl, setStreamUrl] = useState("");
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const streamFallbackTriedRef = useRef(false);
  const captionsVideoIDRef = useRef(videoInfo?.id || "");

  useEffect(() => {
    const nextID = videoInfo?.id || "";
    if (nextID === captionsVideoIDRef.current) return;
    captionsVideoIDRef.current = nextID;
    setCaptions(createDefaultCaptionOptions());
  }, [videoInfo?.id]);

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

  // Keep previews streamed through the range-aware local proxy. Downloading the
  // entire video into a Blob duplicates network traffic and can retain gigabytes
  // in the WebView process for long videos.
  const handleTrimToggle = useCallback(
    async (enabled: boolean) => {
      setTrimEnabled(enabled);
      streamFallbackTriedRef.current = false;

      if (enabled && url && !streamUrl) {
        // Stream via proxy — video appears immediately and seeking uses Range.
        const muxedUrl = findBestMuxedUrl();
        if (muxedUrl) {
          try {
            const proxyUrl = await SetStreamURL(muxedUrl);
            setStreamUrl(proxyUrl);
            return;
          } catch {
            // Fall through to yt-dlp
          }
        }

        // Fallback: yt-dlp extraction → proxy stream.
        setIsLoadingStream(true);
        try {
          const proxyUrl = await GetStreamURL(url, "best[ext=mp4]/best");
          setStreamUrl(proxyUrl);
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

    setIsLoadingStream(true);
    try {
      const proxyUrl = await GetStreamURL(url, "best[ext=mp4]/best");
      setStreamUrl(proxyUrl);
    } catch {
      setStreamUrl("");
    } finally {
      setIsLoadingStream(false);
    }
  }, [url]);

  const handleCutsChange = useCallback((ranges: CutRange[]) => {
    setCutRanges(ranges);
  }, []);

  const handleCaptionsChange = useCallback((options: CaptionOptions) => {
    setCaptions(options);
  }, []);

  const resetTrimmer = useCallback(() => {
    setTrimEnabled(false);
    setCutRanges([]);
    setCaptions(createDefaultCaptionOptions());
    setStreamUrl("");
    streamFallbackTriedRef.current = false;
  }, []);

  return {
    trimEnabled,
    cutRanges,
    captions,
    streamUrl,
    isLoadingStream,
    handleTrimToggle,
    handleStreamError,
    handleCutsChange,
    handleCaptionsChange,
    resetTrimmer,
  };
}
