import { useState, useRef, useEffect, useCallback } from "react";
import { GetVideoInfo } from "../../bindings/kingo/app";
import { useDebounce } from "./useDebounce";

export interface VideoInfo {
  id: string;
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  view_count: number;
  description: string;
  width: number;
  height: number;
  formats: Array<{
    format_id: string;
    url: string;
    ext: string;
    resolution: string;
    filesize: number;
    vcodec: string;
    acodec: string;
    quality: string;
    height: number;
    width: number;
  }>;
}

/**
 * Hook that manages video URL input, debounced fetching, and video info state.
 * Extracts URL handling logic from Video.tsx to reduce re-renders.
 */
export function useVideoFetch() {
  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState("");

  const skipDebounceRef = useRef(false);
  const debouncedUrl = useDebounce(url, 400);

  const isSupportedUrl = useCallback(
    (u: string) =>
      u.includes("youtube.com") ||
      u.includes("youtu.be") ||
      u.includes("tiktok.com") ||
      u.includes("instagram.com"),
    [],
  );

  const fetchVideoInfo = useCallback(async () => {
    if (!url.trim()) return;
    setIsFetching(true);
    setError("");

    try {
      const info = await GetVideoInfo(url);
      setVideoInfo(info as unknown as VideoInfo);
    } catch (err) {
      setError(String(err));
      setVideoInfo(null);
    } finally {
      setIsFetching(false);
    }
  }, [url]);

  // Instant fetch when URL is pasted (bypasses debounce)
  useEffect(() => {
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      fetchVideoInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // Debounced fetch for typed URLs
  useEffect(() => {
    if (!debouncedUrl.trim()) {
      setVideoInfo(null);
      return;
    }
    if (!isSupportedUrl(debouncedUrl)) return;
    if (isFetching) return;
    fetchVideoInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedUrl]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        if (error) setError("");
        if (isSupportedUrl(text)) {
          skipDebounceRef.current = true;
        }
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  }, [error, isSupportedUrl]);

  const onPasteEvent = useCallback(
    (text: string) => {
      if (text && isSupportedUrl(text)) {
        skipDebounceRef.current = true;
      }
    },
    [isSupportedUrl],
  );

  const clearUrl = useCallback(() => {
    setUrl("");
    setVideoInfo(null);
    setError("");
  }, []);

  return {
    url,
    setUrl,
    videoInfo,
    setVideoInfo,
    isFetching,
    error,
    setError,
    handlePaste,
    onPasteEvent,
    clearUrl,
    isSupportedUrl,
  };
}
