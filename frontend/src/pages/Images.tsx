import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  IconSearch,
  IconDownload,
  IconLoader2,
  IconAlertCircle,
  IconCheck,
  IconLink,
  IconFileDescription,
  IconDatabase,
  IconExternalLink,
  IconAdjustments,
  IconChevronDown,
  IconShieldLock,
} from "@tabler/icons-react";
import {
  GetImageInfo,
  DownloadImageAdvanced,
  AddToQueueAdvanced,
} from "../../bindings/kingo/app";
import { useSettingsStore } from "../stores/settingsStore";
import {
  isInstagramUrl,
  isInstagramCDN,
  isInstagramStoryUrl,
  isInstagramAuthenticationError,
} from "../lib/instagramResolver";
import type { CookieBrowser } from "../lib/videoErrors";
import {
  resolveTwitter,
  isTwitterUrl,
  isTwitterCDN,
} from "../lib/twitterResolver";

interface ImageInfo {
  originalUrl: string;
  directUrl: string;
  contentType: string;
  size: number;
  filename: string;
}

// Interface para múltiplas imagens (carrossel)
interface MediaItem {
  url: string;
  type: "image" | "video";
  width?: number;
  height?: number;
  cookieBrowser?: CookieBrowser;
}

const storyBrowserChoices: Array<{
  value: CookieBrowser;
  label: string;
}> = [
  { value: "chrome", label: "Chrome" },
  { value: "edge", label: "Edge" },
  { value: "firefox", label: "Firefox" },
  { value: "brave", label: "Brave" },
];

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function getRequestedMediaIndex(sourceUrl: string, total: number) {
  try {
    const requested = Number(new URL(sourceUrl).searchParams.get("img_index"));
    if (Number.isInteger(requested) && requested >= 1 && requested <= total) {
      return requested - 1;
    }
  } catch {
    // Invalid URLs are handled by the normal search flow.
  }
  return 0;
}

function extensionFor(contentType: string, type: MediaItem["type"]) {
  if (type === "video") return "mp4";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("avif")) return "avif";
  return "jpg";
}

function contentTypeForMedia(item: MediaItem) {
  if (item.type === "video") return "video/mp4";
  try {
    const pathname = new URL(item.url).pathname.toLowerCase();
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".avif")) return "image/avif";
  } catch {
    // Keep the safe JPEG fallback for malformed direct URLs.
  }
  return "image/jpeg";
}

interface ImageOptionSelectProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function ImageOptionSelect({
  label,
  value,
  options,
  onChange,
}: ImageOptionSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <span className="text-xs font-medium text-surface-700 dark:text-surface-600">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border bg-surface-50 px-3 py-2.5 text-left text-xs text-surface-900 outline-none transition-colors dark:bg-surface-200 ${
          open
            ? "border-primary-500 ring-1 ring-primary-500"
            : "border-surface-200 hover:border-surface-300 dark:border-surface-300"
        }`}
      >
        <span className="min-w-0 flex-1 whitespace-normal font-medium leading-relaxed">
          {selected?.label}
        </span>
        <IconChevronDown
          size={15}
          className={`shrink-0 text-surface-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-lg border border-surface-200 bg-white p-1 shadow-xl dark:border-surface-300 dark:bg-surface-100"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? "bg-primary-50 font-semibold text-primary-700 dark:bg-primary-500/10 dark:text-primary-500"
                    : "text-surface-700 hover:bg-surface-50 dark:text-surface-600 dark:hover:bg-surface-200"
                }`}
              >
                <span>{option.label}</span>
                {isSelected && <IconCheck size={14} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ImagesProps {
  onOpenQueue?: () => void;
  initialUrl?: string;
  embedded?: boolean;
}

export default function Images({
  onOpenQueue,
  initialUrl = "",
  embedded = false,
}: ImagesProps) {
  const { t } = useTranslation("images");
  const {
    skipExisting,
    useAria2c,
    aria2cConnections,
    concurrentFragments,
  } = useSettingsStore();
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]); // Para carrossel
  const [selectedIndex, setSelectedIndex] = useState(0); // Índice da imagem selecionada
  const [error, setError] = useState<string | null>(null);
  const [storyAuthRequired, setStoryAuthRequired] = useState(false);
  const [activeStoryBrowser, setActiveStoryBrowser] =
    useState<CookieBrowser | null>(null);
  const [failedStoryBrowser, setFailedStoryBrowser] =
    useState<CookieBrowser | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadPath, setDownloadPath] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [batchSavedCount, setBatchSavedCount] = useState(0);
  const [outputFormat, setOutputFormat] = useState("original");
  const [outputQuality, setOutputQuality] = useState(90);
  const [resolutionScale, setResolutionScale] = useState(100);
  const [previewDimensions, setPreviewDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const lastAutoSearchRef = useRef("");

  const queueVideo = async (item: MediaItem, index: number, total: number) => {
    await AddToQueueAdvanced({
      url: item.url,
      title: `video_${index + 1}_de_${total}`,
      thumbnail: "",
      cookieBrowser: item.cookieBrowser || "",
      format: "best",
      audioOnly: false,
      audioFormat: "",
      audioBitrate: "",
      downloadSubtitles: false,
      subtitleLanguage: "",
      embedSubtitles: false,
      remuxVideo: false,
      remuxFormat: "mp4",
      embedThumbnail: false,
      skipExisting,
      incognito: false,
      useAria2c,
      aria2cConnections,
      concurrentFragments,
      startTime: "",
      endTime: "",
      excludedRanges: [],
      captions: {
        enabled: false,
        source: "auto",
        language: "auto",
        model: "",
        cues: [],
        style: {
          fontFamily: "Arial",
          fontSize: 56,
          textColor: "#FFFFFF",
          backgroundColor: "#000000",
          backgroundOpacity: 0.55,
          outlineColor: "#000000",
          outlineWidth: 3,
          position: "bottom",
          bold: true,
          italic: false,
        },
      },
    });
  };

  const selectMedia = async (items: MediaItem[], index: number) => {
    const item = items[index];
    if (!item) return;

    setSelectedIndex(index);
    setPreviewDimensions(null);
    setDownloadPath(null);
    setBatchSavedCount(0);

    const initialContentType =
      item.type === "video" ? "video/mp4" : "image/jpeg";
    const makeFilename = (contentType: string) =>
      items.length > 1
        ? `${item.type === "video" ? "video" : "imagem"}_${index + 1}_de_${items.length}.${extensionFor(contentType, item.type)}`
        : `instagram_${item.type}.${extensionFor(contentType, item.type)}`;

    setInfo({
      originalUrl: url,
      directUrl: item.url,
      contentType: initialContentType,
      size: 0,
      filename: makeFilename(initialContentType),
    });

    if (item.type !== "image") return;

    try {
      const metadata = await GetImageInfo(item.url);
      if (!metadata) return;
      setInfo((current) =>
        current?.directUrl === item.url
          ? {
              ...current,
              directUrl: metadata.directUrl || current.directUrl,
              contentType: metadata.contentType || current.contentType,
              size: metadata.size,
              filename: makeFilename(
                metadata.contentType || current.contentType,
              ),
            }
          : current,
      );
    } catch {
      // The preview URL is still usable even if metadata probing is blocked.
    }
  };

  const showInstagramMedia = async (carouselResult: {
    mediaItems?: Array<{
      url: string;
      type: string;
      width?: number;
      height?: number;
      cookieBrowser?: string;
    }>;
  } | null) => {
    if (!carouselResult?.mediaItems?.length) return false;

    const convertedMedia: MediaItem[] = carouselResult.mediaItems.map(
      (item) => ({
        url: item.url,
        type: item.type as "image" | "video",
        width: item.width,
        height: item.height,
        cookieBrowser: item.cookieBrowser as CookieBrowser | undefined,
      }),
    );
    const initialIndex = getRequestedMediaIndex(url, convertedMedia.length);
    setMediaItems(convertedMedia);
    await selectMedia(convertedMedia, initialIndex);
    return true;
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setStoryAuthRequired(false);
    setActiveStoryBrowser(null);
    setFailedStoryBrowser(null);
    setInfo(null);
    setMediaItems([]);
    setSelectedIndex(0);
    setPreviewDimensions(null);
    setDownloadPath(null);
    setBatchProgress(null);
    setBatchSavedCount(0);

    try {
      // Verificar se é URL de rede social (não CDN direto)
      const isIGPost = isInstagramUrl(url) && !isInstagramCDN(url);
      const isIGStory = isInstagramStoryUrl(url);
      const isTWPost = isTwitterUrl(url) && !isTwitterCDN(url);

      if (isIGPost) {
        // Instagram vai direto para o backend Go (client-side falha por CORS)
        try {
          const { GetInstagramCarousel } = await import(
            "../../bindings/kingo/app"
          );
          const carouselResult = await GetInstagramCarousel(url);
          if (await showInstagramMedia(carouselResult)) {
            setLoading(false);
            return;
          }
        } catch (instagramError) {
          if (
            isIGStory &&
            isInstagramAuthenticationError(instagramError)
          ) {
            setStoryAuthRequired(true);
            return;
          }
          // Fallback para próxima estratégia
        }
      }

      if (isTWPost) {
        const twResult = await resolveTwitter(url);

        if (twResult.success && twResult.media.length > 0) {
          // Armazenar TODAS as mídias encontradas
          setMediaItems(twResult.media);
          await selectMedia(twResult.media, 0);
          setLoading(false);
          return;
        }
      }

      // Fallback: Backend Go
      const result = await GetImageInfo(url);
      setInfo(result);
    } catch (err: unknown) {
      const errorMessage = String(err).toLowerCase();

      // Detectar tipo de site para mensagem personalizada
      const isCDN =
        url.includes("cdninstagram.com") ||
        url.includes("fbcdn.net") ||
        url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i);
      const isInstagram = url.includes("instagram.com") && !isCDN;
      const isTwitter =
        (url.includes("twitter.com") || url.includes("x.com")) && !isCDN;

      if (isInstagram) {
        setError("INSTAGRAM_BLOCKED:" + url);
      } else if (isTwitter) {
        setError("TWITTER_BLOCKED:" + url);
      } else if (
        errorMessage.includes("access") ||
        errorMessage.includes("denied") ||
        errorMessage.includes("login") ||
        errorMessage.includes("blocked")
      ) {
        setError(
          "Este site requer autenticação ou bloqueou o acesso. " +
            "Abra a imagem no navegador e copie o link direto do arquivo."
        );
      } else {
        setError(
          "Não foi possível encontrar uma imagem nesta URL. " +
            "Tente o link direto do arquivo de imagem (ex: terminando em .jpg, .png, .webp)."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!embedded || !initialUrl || lastAutoSearchRef.current === initialUrl) {
      return;
    }
    lastAutoSearchRef.current = initialUrl;
    void handleSearch();
    // The embedded component is keyed by initialUrl, so each URL mounts once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, initialUrl]);

  const handleDownload = async () => {
    if (!info) return;

    setDownloading(true);
    setDownloadPath(null);
    setBatchSavedCount(0);
    try {
      const selectedItem = mediaItems[selectedIndex];
      if (info.contentType.includes("video") || selectedItem?.type === "video") {
        await queueVideo(
          selectedItem || { url: info.directUrl, type: "video" },
          selectedIndex,
          Math.max(mediaItems.length, 1),
        );
        onOpenQueue?.();
        return;
      }

      // Usa o nome sugerido pelo backend ou cria um timestamp
      const filename = info.filename || `image_${Date.now()}.jpg`;
      const path = await DownloadImageAdvanced(
        info.directUrl,
        filename,
        outputFormat,
        outputQuality,
        resolutionScale,
      );
      setDownloadPath(path);
    } catch (err: unknown) {
      setError(t("error.download", { message: String(err) }));
    } finally {
      setDownloading(false);
    }
  };

  const retryStoryWithBrowser = async (browser: CookieBrowser) => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setActiveStoryBrowser(browser);
    setFailedStoryBrowser(null);

    try {
      const { GetInstagramCarouselWithCookies } = await import(
        "../../bindings/kingo/app"
      );
      const result = await GetInstagramCarouselWithCookies(url, browser);
      if (!(await showInstagramMedia(result))) {
        throw new Error("instagram_auth_failed");
      }
      setStoryAuthRequired(false);
    } catch {
      setStoryAuthRequired(true);
      setFailedStoryBrowser(browser);
    } finally {
      setActiveStoryBrowser(null);
      setLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    const downloadItems = mediaItems.map((item, index) => ({ item, index }));
    if (downloadItems.length < 2) return;

    setError(null);
    setDownloadPath(null);
    setBatchSavedCount(0);
    setBatchProgress({ current: 0, total: downloadItems.length });

    let lastPath = "";
    let completed = 0;
    let queuedVideos = 0;
    const source = isInstagramUrl(url)
      ? "instagram"
      : isTwitterUrl(url)
        ? "twitter"
        : "galeria";

    try {
      for (const { item, index } of downloadItems) {
        setBatchProgress({
          current: completed + 1,
          total: downloadItems.length,
        });

        if (item.type === "video") {
          await queueVideo(item, index, mediaItems.length);
          queuedVideos += 1;
          completed += 1;
          continue;
        }

        const contentType = contentTypeForMedia(item);
        const extension = extensionFor(contentType, item.type);
        const filename = `${source}_${String(index + 1).padStart(2, "0")}_de_${String(mediaItems.length).padStart(2, "0")}.${extension}`;
        lastPath = await DownloadImageAdvanced(
          item.url,
          filename,
          outputFormat,
          outputQuality,
          resolutionScale,
        );
        completed += 1;
      }

      setBatchSavedCount(completed);
      setDownloadPath(lastPath || "queue");
      if (queuedVideos > 0) {
        onOpenQueue?.();
      }
    } catch (err: unknown) {
      setError(
        t("error.download_all", {
          completed,
          total: downloadItems.length,
          message: String(err),
        }),
      );
    } finally {
      setBatchProgress(null);
    }
  };

  return (
    <div
      className={
        embedded
          ? "w-full"
          : "mx-auto h-full w-full max-w-[1600px] overflow-y-auto p-5 custom-scrollbar sm:p-6 lg:p-8"
      }
    >
      {!embedded && (
        <>
          <div className="mb-6 border-b border-surface-200 pb-5 dark:border-surface-300">
            <h1 className="text-2xl font-semibold text-surface-900 mb-1 dark:text-surface-900 tracking-tight">
              {t("title")}
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t("subtitle")}
            </p>
          </div>

          {/* Input Section */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <IconLink
                  className="text-surface-400 group-focus-within:text-primary-600 transition-colors"
                  size={20}
                />
              </div>
              <input
                type="text"
                className="w-full pl-10 pr-32 py-3 bg-white dark:bg-surface-100 border border-surface-200 dark:border-surface-300 rounded-md focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-all placeholder:text-surface-400 text-sm text-surface-900 dark:text-surface-700"
                placeholder={t("placeholder")}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                type="submit"
                disabled={loading || !url}
                className="absolute right-1.5 top-1.5 bottom-1.5 bg-primary-600 hover:bg-primary-700 text-white px-4 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                {loading ? (
                  <IconLoader2 className="animate-spin" size={16} />
                ) : (
                  <IconSearch size={16} />
                )}
                <span>{t("search")}</span>
              </button>
            </div>
          </form>
        </>
      )}

      {embedded && loading && (
        <div className="card flex items-center justify-center gap-3 p-8 text-sm text-surface-500">
          <IconLoader2 size={20} className="animate-spin text-primary-600" />
          <span>{t("loading_content")}</span>
        </div>
      )}

      {storyAuthRequired && (
        <div
          role="alert"
          aria-live="polite"
          className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-left dark:border-amber-500/35 dark:bg-amber-500/10"
        >
          <div className="flex items-start gap-3">
            <IconShieldLock
              size={22}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                {t("story_auth.title")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
                {t("story_auth.description")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {storyBrowserChoices.map((browser) => {
                  const isActive = activeStoryBrowser === browser.value;
                  return (
                    <button
                      key={browser.value}
                      type="button"
                      disabled={activeStoryBrowser !== null}
                      onClick={() => retryStoryWithBrowser(browser.value)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:border-amber-400/50 dark:bg-surface-200 dark:text-amber-100 dark:hover:bg-surface-300 dark:focus-visible:ring-offset-surface-50"
                    >
                      {isActive && (
                        <IconLoader2
                          size={16}
                          aria-hidden="true"
                          className="animate-spin"
                        />
                      )}
                      {t("story_auth.use_browser", {
                        browser: browser.label,
                      })}
                    </button>
                  );
                })}
              </div>
              {failedStoryBrowser && !activeStoryBrowser && (
                <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">
                  {t("story_auth.failed", {
                    browser:
                      storyBrowserChoices.find(
                        (browser) => browser.value === failedStoryBrowser,
                      )?.label ?? failedStoryBrowser,
                  })}
                </p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                {t("story_auth.privacy")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            {error.startsWith("INSTAGRAM_BLOCKED:") ||
            error.startsWith("TWITTER_BLOCKED:") ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-900/30">
                <div className="flex items-start gap-3">
                  <IconAlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold mb-2">
                      {t("error.blocked_title", {
                        platform: error.startsWith("INSTAGRAM_BLOCKED:")
                          ? "Instagram"
                          : "Twitter/X",
                      })}
                    </p>
                    <p className="text-sm mb-3 text-amber-600 dark:text-amber-300">
                      {t("error.blocked_description")}
                    </p>
                    <ol className="text-sm list-decimal list-inside space-y-1 mb-4 text-amber-600 dark:text-amber-300">
                      <li>{t("error.step_1")}</li>
                      <li>{t("error.step_2")}</li>
                      <li>{t("error.step_3")}</li>
                      <li>{t("error.step_4")}</li>
                      <li>{t("error.step_5")}</li>
                    </ol>
                    <button
                      onClick={() => {
                        const blockedUrl = error.split(":").slice(1).join(":");
                        window.open(blockedUrl, "_blank");
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-sm font-medium transition-colors"
                    >
                      <IconExternalLink size={16} />
                      {t("error.open_browser")}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md flex items-center gap-2 border border-red-200 dark:border-red-900/30 text-sm">
                <IconAlertCircle size={18} />
                <span className="font-medium">{error}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Section */}
      <AnimatePresence>
        {info && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm dark:border-surface-300 dark:bg-surface-100"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
              {/* Preview Area */}
              <div className="relative flex min-w-0 flex-col items-center justify-center border-b border-surface-200 bg-surface-50 p-4 dark:border-surface-300 dark:bg-surface-50 sm:p-5 lg:border-b-0 lg:border-r">
                {/* Checkerboard Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0ibm9uZSI+PHBhdGggZmlsbD0iIzAwMCIgZmlsbC1vcGFjaXR5PSIuMiIgZD0iTTAgMGgxMHYxMEgwem0xMCAxMGgxMHYxMEgxMHoiLz48L3N2Zz4=')] pointer-events-none" />

                {/* Main Image */}
                <div className="relative z-10 flex min-h-72 w-full items-center justify-center bg-transparent p-2">
                  {info.contentType.includes("video") ? (
                    <video
                      src={info.directUrl}
                      controls
                      className="max-h-[48vh] w-full rounded-lg object-contain shadow-md"
                    />
                  ) : (
                    <img
                      src={info.directUrl}
                      alt="Preview"
                      onLoad={(event) => {
                        const { naturalWidth, naturalHeight } =
                          event.currentTarget;
                        setPreviewDimensions({
                          width: naturalWidth,
                          height: naturalHeight,
                        });
                        setMediaItems((current) =>
                          current.map((item, index) =>
                            index === selectedIndex &&
                            (!item.width || !item.height)
                              ? {
                                  ...item,
                                  width: naturalWidth,
                                  height: naturalHeight,
                                }
                              : item,
                          ),
                        );
                      }}
                      className="max-h-[48vh] max-w-full rounded-lg object-contain shadow-md"
                    />
                  )}
                </div>

                {/* Carousel Thumbnails */}
                {mediaItems.length > 1 && (
                  <div className="relative z-10 mt-4 w-full border-t border-surface-200 pt-4 dark:border-surface-300">
                    <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                      {t("gallery", { count: mediaItems.length })}
                    </p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                      {mediaItems.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => void selectMedia(mediaItems, idx)}
                          aria-label={`${idx + 1} / ${mediaItems.length}`}
                          className={`relative aspect-square min-w-0 overflow-hidden rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${
                            selectedIndex === idx
                              ? "border-primary-500 opacity-100 shadow-sm"
                              : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={item.url}
                            alt={`Thumb ${idx}`}
                            className="w-full h-full object-cover"
                          />
                          {item.type === "video" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-4 h-4 rounded-full bg-white/90 flex items-center justify-center">
                                <div className="ml-0.5 w-0 h-0 border-t-[3px] border-t-transparent border-l-[5px] border-l-black border-b-[3px] border-b-transparent"></div>
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Info & Actions */}
              <div className="flex flex-col bg-white p-5 dark:bg-surface-100">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                      <IconCheck size={10} stroke={3} /> {t("available")}
                    </span>
                    <span className="bg-surface-100 dark:bg-surface-200 text-surface-600 dark:text-surface-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      {info.contentType.split("/")[1]?.toUpperCase() ||
                        t("unknown")}
                    </span>
                    {mediaItems.length > 1 && (
                      <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        {selectedIndex + 1} / {mediaItems.length}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-900 break-all mb-6 leading-tight">
                    {info.filename || "imagem_sem_nome"}
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-surface-100 dark:border-surface-300 bg-surface-50/50 dark:bg-surface-200/50">
                      <div className="text-surface-400">
                        <IconFileDescription size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-surface-500">
                          {t("type")}
                        </p>
                        <p className="font-mono text-xs text-surface-700 dark:text-surface-600">
                          {info.contentType}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border border-surface-100 dark:border-surface-300 bg-surface-50/50 dark:bg-surface-200/50">
                      <div className="text-surface-400">
                        <IconDatabase size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-surface-500">
                          {t("size")}
                        </p>
                        <p className="font-mono text-xs text-surface-700 dark:text-surface-600">
                          {info.size > 0 ? formatBytes(info.size) : t("unknown")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg border border-surface-100 dark:border-surface-300 bg-surface-50/50 dark:bg-surface-200/50">
                      <div className="text-surface-400">
                        <IconDatabase size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-surface-500">
                          {t("resolution")}
                        </p>
                        <p className="font-mono text-xs text-surface-700 dark:text-surface-600">
                          {previewDimensions
                            ? `${previewDimensions.width}x${previewDimensions.height}`
                            : t("original")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!info.contentType.includes("video") && (
                    <div className="mt-5 border-t border-surface-200 pt-4 dark:border-surface-300">
                      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-surface-500">
                        <IconAdjustments size={15} />
                        {t("output_options")}
                      </div>

                      <div className="space-y-3">
                        <ImageOptionSelect
                          label={t("output_format")}
                          value={outputFormat}
                          onChange={setOutputFormat}
                          options={[
                            {
                              value: "original",
                              label: t("format_original"),
                            },
                            { value: "jpg", label: "JPG" },
                            { value: "png", label: "PNG" },
                            { value: "webp", label: "WEBP" },
                            { value: "avif", label: "AVIF" },
                          ]}
                        />

                        <ImageOptionSelect
                          label={t("resolution_scale")}
                          value={String(resolutionScale)}
                          onChange={(value) =>
                            setResolutionScale(Number(value))
                          }
                          options={[25, 50, 75, 100, 125, 150, 200].map(
                            (scale) => ({
                              value: String(scale),
                              label: previewDimensions
                                ? `${scale}% · ${Math.round((previewDimensions.width * scale) / 100)}×${Math.round((previewDimensions.height * scale) / 100)}`
                                : `${scale}%`,
                            }),
                          )}
                        />
                      </div>

                      {outputFormat !== "original" &&
                        outputFormat !== "png" && (
                          <label className="mt-3 block space-y-1.5">
                            <span className="flex items-center justify-between text-xs font-medium text-surface-700 dark:text-surface-600">
                              <span>{t("quality")}</span>
                              <span className="font-mono text-surface-500">
                                {outputQuality}%
                              </span>
                            </span>
                            <input
                              type="range"
                              min="10"
                              max="100"
                              step="5"
                              value={outputQuality}
                              onChange={(event) =>
                                setOutputQuality(Number(event.target.value))
                              }
                              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-200 accent-primary-600 dark:bg-surface-300"
                            />
                          </label>
                        )}

                      {resolutionScale > 100 && (
                        <p className="mt-3 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                          {t("upscale_warning")}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-8 space-y-3">
                  {mediaItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => void handleDownloadAll()}
                      disabled={
                        downloading || !!batchProgress || !!downloadPath
                      }
                      className={`flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                        batchSavedCount > 0
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-primary-600 hover:bg-primary-700"
                      }`}
                    >
                      {batchProgress ? (
                        <>
                          <IconLoader2 className="animate-spin" size={18} />
                          <span>
                            {t("downloading_all", batchProgress)}
                          </span>
                        </>
                      ) : batchSavedCount > 0 ? (
                        <>
                          <IconCheck size={18} />
                          <span>
                            {t("saved_all", { count: batchSavedCount })}
                          </span>
                        </>
                      ) : (
                        <>
                          <IconDownload size={18} />
                          <span>
                            {t("download_all", {
                              count: mediaItems.length,
                            })}
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={handleDownload}
                    disabled={downloading || !!batchProgress || !!downloadPath}
                    className={`w-full py-2.5 px-4 rounded-md font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                      downloadPath && batchSavedCount === 0
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-surface-900 text-surface-50 hover:bg-surface-800"
                    } disabled:opacity-70 disabled:cursor-not-allowed`}
                  >
                    {downloading ? (
                      <>
                        <IconLoader2 className="animate-spin" size={18} />
                        <span>{t("downloading")}</span>
                      </>
                    ) : downloadPath && batchSavedCount === 0 ? (
                      <>
                        <IconCheck size={18} />
                        <span>{t("saved")}</span>
                      </>
                    ) : (
                      <>
                        <IconDownload size={18} />
                        <span>
                          {t("download_selected")}{" "}
                          {mediaItems.length > 1
                            ? `(${selectedIndex + 1})`
                            : ""}
                        </span>
                      </>
                    )}
                  </button>

                  {downloadPath && (
                    <button
                      onClick={() => {
                        // Abrir pasta (implementar função no backend se necessário, ou apenas limpar)
                        setDownloadPath(null);
                        setBatchSavedCount(0);
                        setBatchProgress(null);
                        setInfo(null);
                        setMediaItems([]);
                        setUrl("");
                      }}
                      className="w-full py-2 px-4 rounded-md font-medium text-sm text-surface-600 dark:text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-200 transition-colors"
                    >
                      {t("download_another")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
