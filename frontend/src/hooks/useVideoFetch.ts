import { useState, useRef, useEffect, useCallback } from "react";
import {
  GetVideoInfo,
  GetVideoInfoWithCookies,
} from "../../bindings/kingo/app";
import { useDebounce } from "./useDebounce";
import { shouldUseVideoDownloader } from "../lib/downloadRouter";
import type { SubtitleLanguage } from "../components/video/captions";
import {
  cleanVideoError,
  isYoutubeAuthenticationError,
  type CookieBrowser,
} from "../lib/videoErrors";

export interface VideoInfo {
  id: string;
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  view_count: number;
  description: string;
  language: string;
  width: number;
  height: number;
  subtitle_languages: SubtitleLanguage[];
  cookie_browser?: string;
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
  const [error, setErrorState] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [activeAuthBrowser, setActiveAuthBrowser] =
    useState<CookieBrowser | null>(null);
  const [failedAuthBrowser, setFailedAuthBrowser] =
    useState<CookieBrowser | null>(null);

  const setError = useCallback((message: string) => {
    setErrorState(message);
    setAuthRequired(false);
    setFailedAuthBrowser(null);
  }, []);

  const skipDebounceRef = useRef(false);
  const debouncedUrl = useDebounce(url, 400);

  const isSupportedUrl = useCallback(
    (u: string) => shouldUseVideoDownloader(u),
    [],
  );

  const fetchVideoInfo = useCallback(async () => {
    if (!url.trim()) return;
    setIsFetching(true);
    setError("");
    setAuthRequired(false);
    setFailedAuthBrowser(null);

    try {
      const info = await GetVideoInfo(url);
      setVideoInfo(info as unknown as VideoInfo);
    } catch (err) {
      if (isYoutubeAuthenticationError(err)) {
        setAuthRequired(true);
      } else {
        setError(cleanVideoError(err));
      }
      setVideoInfo(null);
    } finally {
      setIsFetching(false);
    }
  }, [url, setError]);

  const retryWithBrowser = useCallback(
    async (browser: CookieBrowser) => {
      if (!url.trim()) return;
      setIsFetching(true);
      setActiveAuthBrowser(browser);
      setFailedAuthBrowser(null);
      setError("");

      try {
        const info = await GetVideoInfoWithCookies(url, browser);
        setVideoInfo(info as unknown as VideoInfo);
        setAuthRequired(false);
      } catch (err) {
        console.warn(`Could not use the ${browser} session:`, err);
        setVideoInfo(null);
        setAuthRequired(true);
        setFailedAuthBrowser(browser);
      } finally {
        setActiveAuthBrowser(null);
        setIsFetching(false);
      }
    },
    [url, setError],
  );

  useEffect(() => {
    setAuthRequired(false);
    setActiveAuthBrowser(null);
    setFailedAuthBrowser(null);
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
  }, [error, isSupportedUrl, setError]);

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
    setAuthRequired(false);
    setActiveAuthBrowser(null);
    setFailedAuthBrowser(null);
  }, [setError]);

  return {
    url,
    setUrl,
    videoInfo,
    setVideoInfo,
    isFetching,
    error,
    setError,
    authRequired,
    activeAuthBrowser,
    failedAuthBrowser,
    retryWithBrowser,
    handlePaste,
    onPasteEvent,
    clearUrl,
    isSupportedUrl,
  };
}
