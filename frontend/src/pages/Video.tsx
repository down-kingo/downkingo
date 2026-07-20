import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { safeEventsOn } from "../lib/wailsRuntime";
import { useDownloadStore } from "../stores/downloadStore";
import { useDownloadSync } from "../hooks/useDownloadSync";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore, type FeatureId } from "../stores/settingsStore";
import { useTranslation } from "react-i18next";
import { shouldUseMediaInspector } from "../lib/downloadRouter";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useVideoFetch } from "../hooks/useVideoFetch";
import { useTrimmer } from "../hooks/useTrimmer";
import SettingsPanel, { SettingsTab } from "../components/SettingsPanel";
import Terminal from "../components/Terminal";
import OnboardingModal from "../components/OnboardingModal";
import DonationBanner from "../components/DonationBanner";
import QueueList from "../components/QueueList";
import { Sidebar, Topbar, TabType } from "../components/navigation";
import {
  getVideoQualities,
  AUDIO_FORMATS,
  VideoTrimmer,
} from "../components/video";
import { BrowserAuthPrompt } from "../components/video/BrowserAuthPrompt";
const Images = lazy(() => import("./Images"));
const Converter = lazy(() => import("./Converter"));
const Transcriber = lazy(() => import("./Transcriber"));
const Roadmap = lazy(() => import("./Roadmap"));
const Dashboard = lazy(() => import("./Dashboard"));
import { HistoryView } from "../components/HistoryView";
import { Skeleton } from "../components/Skeleton";
import { TabContent } from "../components/TabContent";
import { RouteErrorBoundary } from "../components/ErrorBoundary";
import {
  GetVersion,
  AddToQueueAdvanced,
  UpdateYtDlp,
  CheckForUpdate,
  InstallAppVersion,
  RestartApp,
  CheckAria2cStatus,
  DownloadAria2c,
} from "../../bindings/kingo/app";
import {
  IconDownload,
  IconX,
  IconMusic,
  IconVideo,
  IconCloud,
  IconLoader2,
  IconSearch,
  IconList,
  IconRocket,
  IconSettings,
  IconClipboard,
} from "@tabler/icons-react";

// Memoized Suspense fallback to avoid recreating on every render
const SuspenseFallback = (
  <div className="flex-1 flex items-center justify-center">
    <IconLoader2 size={32} className="animate-spin text-primary-500" />
  </div>
);

const TAB_TO_FEATURE: Partial<Record<TabType, FeatureId>> = {
  video: "videos",
  images: "images",
  converter: "converter",
  transcriber: "transcriber",
};

interface QuickTurboOptionsProps {
  label: string;
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
}

function QuickTurboOptions({
  label,
  values,
  selected,
  onSelect,
}: QuickTurboOptionsProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-surface-500">
        {label}
      </legend>
      <div className="grid grid-cols-4 gap-2">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={selected === value}
            onClick={() => onSelect(value)}
            className={`rounded-lg border px-2 py-1.5 text-xs font-bold transition-colors ${
              selected === value
                ? "border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-500"
                : "border-surface-200 dark:border-surface-300 text-surface-600 dark:text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-200"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

interface QuickSettingToggleProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}

function QuickSettingToggle({
  checked,
  disabled = false,
  label,
  onChange,
}: QuickSettingToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-wait disabled:opacity-60 ${
        checked
          ? "bg-primary-600 dark:bg-primary-500 shadow-sm shadow-primary-600/20"
          : "bg-surface-200 dark:bg-surface-300 hover:bg-surface-300 dark:hover:bg-surface-400"
      }`}
    >
      {disabled ? (
        <IconLoader2
          size={14}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-surface-500"
        />
      ) : (
        <span
          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      )}
    </button>
  );
}

export default function Video() {
  const settings = useSettingsStore(
    useShallow((state) => ({
      layout: state.layout,
      language: state.language,
      remuxVideo: state.remuxVideo,
      remuxFormat: state.remuxFormat,
      embedThumbnail: state.embedThumbnail,
      skipExisting: state.skipExisting,
      autoUpdateYtDlp: state.autoUpdateYtDlp,
      ytDlpChannel: state.ytDlpChannel,
      autoUpdateApp: state.autoUpdateApp,
      videoCompatibility: state.videoCompatibility,
      useAria2c: state.useAria2c,
      aria2cConnections: state.aria2cConnections,
      concurrentFragments: state.concurrentFragments,
      setSetting: state.setSetting,
    })),
  );

  const {
    layout,
    remuxVideo,
    remuxFormat,
    embedThumbnail,
    skipExisting,
    autoUpdateYtDlp,
    ytDlpChannel,
    autoUpdateApp,
    videoCompatibility,
    useAria2c,
    aria2cConnections,
    concurrentFragments,
    setSetting,
  } = settings;
  const enabledFeatures = useSettingsStore((s) => s.enabledFeatures);
  const { t } = useTranslation("common");
  const { t: settingsT } = useTranslation("settings");
  const pasteShortcut = useMemo(
    () => (navigator.userAgent.includes("Mac") ? "⌘V" : "Ctrl+V"),
    [],
  );

  const VIDEO_QUALITIES = useMemo(
    () => getVideoQualities(videoCompatibility),
    [videoCompatibility],
  );

  // Custom hooks for isolated state management
  const {
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
    onPasteEvent,
    clearUrl: clearUrlState,
  } = useVideoFetch();

  const {
    trimEnabled,
    cutRanges,
    captions,
    streamUrl,
    handleTrimToggle,
    handleStreamError,
    handleCutsChange,
    handleCaptionsChange,
    resetTrimmer,
  } = useTrimmer(videoInfo, url);

  const [isLoading, setIsLoading] = useState(false);
  const [mediaURL, setMediaURL] = useState("");
  const [version, setVersion] = useState("");

  // Tab state
  const [activeTab, setActiveTabRaw] = useState<TabType>("home");

  // Map TabType → FeatureId for feature-gated tabs
  // Guard: only allow navigation to enabled tabs
  const setActiveTab = useCallback(
    (tab: TabType) => {
      if (tab === "images") tab = "video";
      if (
        tab === "video" &&
        (enabledFeatures.includes("videos") ||
          enabledFeatures.includes("images"))
      ) {
        setActiveTabRaw("video");
        return;
      }
      const requiredFeature = TAB_TO_FEATURE[tab];
      if (requiredFeature && !enabledFeatures.includes(requiredFeature)) {
        return;
      }
      setActiveTabRaw(tab);
    },
    [enabledFeatures],
  );

  // Reset to home if current tab was disabled
  useEffect(() => {
    if (
      activeTab === "video" &&
      (enabledFeatures.includes("videos") || enabledFeatures.includes("images"))
    ) {
      return;
    }
    const requiredFeature = TAB_TO_FEATURE[activeTab];
    if (requiredFeature && !enabledFeatures.includes(requiredFeature)) {
      setActiveTabRaw("home");
    }
  }, [enabledFeatures, activeTab]);

  // Settings panel state
  const [settingsState, setSettingsState] = useState<{
    isOpen: boolean;
    tab?: SettingsTab;
    targetId?: string;
  }>({ isOpen: false });

  const openSettings = useCallback(
    (tab: SettingsTab = "general", targetId?: string) => {
      setSettingsState({ isOpen: true, tab, targetId });
    },
    [],
  );

  const closeSettings = useCallback(() => {
    setSettingsState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);
  const turboMenuRef = useRef<HTMLDivElement>(null);
  const [turboMenuOpen, setTurboMenuOpen] = useState(false);
  const [isCheckingTurbo, setIsCheckingTurbo] = useState(false);

  const applyUnifiedURL = useCallback(
    (value: string) => {
      if (shouldUseMediaInspector(value)) {
        setMediaURL(value);
        setUrl("");
        setVideoInfo(null);
        setError("");
        return;
      }
      setMediaURL("");
      setUrl(value);
    },
    [setError, setUrl, setVideoInfo],
  );

  const handleUnifiedPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) applyUnifiedURL(text);
    } catch (pasteError) {
      console.error("Failed to read clipboard:", pasteError);
    }
  }, [applyUnifiedURL]);

  const toggleTurbo = useCallback(async () => {
    if (useAria2c) {
      setSetting("useAria2c", false);
      return;
    }

    setIsCheckingTurbo(true);
    try {
      let status = await CheckAria2cStatus();
      if (!status.installed) {
        await DownloadAria2c();
        status = await CheckAria2cStatus();
      }

      if (status.installed) {
        setSetting("useAria2c", true);
      } else {
        setError(t("home.turbo_not_installed"));
      }
    } catch (turboError) {
      setError(String(turboError));
    } finally {
      setIsCheckingTurbo(false);
    }
  }, [setError, setSetting, t, useAria2c]);

  useEffect(() => {
    if (!turboMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!turboMenuRef.current?.contains(event.target as Node)) {
        setTurboMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTurboMenuOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [turboMenuOpen]);

  useKeyboardShortcuts({
    onOpenSettings: () => openSettings(),
    onFocusInput: () => {
      if (
        enabledFeatures.includes("videos") ||
        enabledFeatures.includes("images")
      ) {
        setActiveTab("video");
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
  });

  // Listen for clipboard link detected events (from native notification callback)
  useEffect(() => {
    let cancel: (() => void) | undefined;
    let disposed = false;

    safeEventsOn<string>("clipboard:link-detected", (detectedUrl) => {
      if (
        detectedUrl &&
        (enabledFeatures.includes("videos") ||
          enabledFeatures.includes("images"))
      ) {
        applyUnifiedURL(detectedUrl);
        setActiveTab("video");
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }).then((unsubscribe) => {
      if (disposed) unsubscribe();
      else cancel = unsubscribe;
    });

    return () => {
      disposed = true;
      cancel?.();
    };
  }, [applyUnifiedURL, enabledFeatures, setActiveTab]);

  // Video info state
  const [downloadMode, setDownloadMode] = useState<"video" | "audio">("video");
  const [selectedQuality, setSelectedQuality] = useState(
    getVideoQualities("universal")[1].value,
  );
  const [selectedAudioFormat, setSelectedAudioFormat] = useState("mp3");

  // Auto-Update Logic (apenas em produção, rate limited 1x/dia)
  useEffect(() => {
    const isDev =
      window.location.hostname === "localhost" ||
      window.location.port === "5173";
    if (isDev) return;

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    const lastCheck = localStorage.getItem("kingo:lastUpdateCheck");
    const now = Date.now();

    if (lastCheck && now - parseInt(lastCheck) < TWENTY_FOUR_HOURS) {
      return;
    }

    localStorage.setItem("kingo:lastUpdateCheck", now.toString());

    if (autoUpdateYtDlp) {
      UpdateYtDlp(ytDlpChannel || "stable").catch(() => {});
    }

    if (autoUpdateApp) {
      CheckForUpdate()
        .then((info) => {
          if (info?.available) {
            InstallAppVersion(info.latestVersion)
              .then(() => RestartApp())
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [autoUpdateYtDlp, ytDlpChannel, autoUpdateApp]);

  const { queue } = useDownloadStore();
  useDownloadSync();

  useEffect(() => {
    GetVersion().then(setVersion);
  }, []);

  // Auto-select best available quality
  useEffect(() => {
    if (!videoInfo || !videoInfo.formats) return;

    const maxH = Math.max(...videoInfo.formats.map((f) => f.height || 0));

    const bestFit = VIDEO_QUALITIES.find((q) => maxH >= (q.minHeight || 0));

    if (bestFit) {
      const currentOption = VIDEO_QUALITIES.find(
        (q) => q.value === selectedQuality,
      );
      const currentIsAvailable =
        currentOption && maxH >= (currentOption.minHeight || 0);

      if (!currentIsAvailable) {
        setSelectedQuality(bestFit.value);
      }
    }
  }, [videoInfo, VIDEO_QUALITIES, selectedQuality]);

  const handleDownload = useCallback(async () => {
    if (!url.trim() || !videoInfo) return;
    setIsLoading(true);
    setError("");

    try {
      await AddToQueueAdvanced({
        url,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        cookieBrowser: videoInfo.cookie_browser || "",
        format: downloadMode === "video" ? selectedQuality : "bestaudio",
        audioOnly: downloadMode === "audio",
        audioFormat: downloadMode === "audio" ? selectedAudioFormat : "",
        audioBitrate: "320",
        downloadSubtitles: false,
        subtitleLanguage: "",
        embedSubtitles: false,
        remuxVideo: downloadMode === "video" ? remuxVideo : false,
        remuxFormat: remuxFormat || "mp4",
        embedThumbnail: embedThumbnail,
        skipExisting: skipExisting,
        incognito: false,
        useAria2c: useAria2c,
        aria2cConnections: aria2cConnections,
        concurrentFragments: concurrentFragments,
        startTime: "",
        endTime: "",
        excludedRanges: trimEnabled ? cutRanges : [],
        captions: downloadMode === "video" ? captions : { ...captions, enabled: false },
      });
      clearUrlState();
      resetTrimmer();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, [
    url,
    videoInfo,
    downloadMode,
    selectedQuality,
    selectedAudioFormat,
    remuxVideo,
    remuxFormat,
    embedThumbnail,
    skipExisting,
    useAria2c,
    aria2cConnections,
    concurrentFragments,
    trimEnabled,
    cutRanges,
    captions,
    clearUrlState,
    resetTrimmer,
    setError,
  ]);

  const clearUrl = useCallback(() => {
    setMediaURL("");
    clearUrlState();
    resetTrimmer();
  }, [clearUrlState, resetTrimmer]);

  const formatDuration = useCallback((seconds: number) => {
    if (!seconds) return "";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const formatViews = useCallback((count: number) => {
    if (!count) return "";
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  }, []);

  // Memoized available qualities based on video info
  const availableQualities = useMemo(() => {
    if (!videoInfo?.formats) return VIDEO_QUALITIES;
    const maxH = Math.max(...videoInfo.formats.map((f) => f.height || 0));
    return VIDEO_QUALITIES.filter((q) => maxH >= (q.minHeight || 0));
  }, [videoInfo, VIDEO_QUALITIES]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-50 dark:bg-surface-50 text-surface-900 transition-colors duration-300">
      <OnboardingModal />

      <div
        className={`flex-1 flex overflow-hidden ${
          layout === "sidebar" ? "flex-row" : "flex-col"
        }`}
      >
        {/* Navigation - Conditional Rendering based on Layout */}
        {layout === "sidebar" ? (
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            queueCount={queue.length}
            version={version}
            onOpenSettings={() => openSettings()}
          />
        ) : (
          <Topbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            queueCount={queue.length}
            onOpenSettings={() => openSettings()}
          />
        )}

        {/* Main Content Wrapper */}
        <main className="flex-1 flex flex-col overflow-hidden relative w-full min-h-0">
          <AnimatePresence mode="wait">
            {activeTab === "home" && (
              <TabContent key="home">
                <RouteErrorBoundary>
                  <Suspense fallback={SuspenseFallback}>
                    <Dashboard onNavigate={setActiveTab} />
                  </Suspense>
                </RouteErrorBoundary>
              </TabContent>
            )}

            {activeTab === "converter" &&
              enabledFeatures.includes("converter") && (
                <TabContent key="converter">
                  <RouteErrorBoundary>
                    <Suspense fallback={SuspenseFallback}>
                      <Converter />
                    </Suspense>
                  </RouteErrorBoundary>
                </TabContent>
              )}

            {activeTab === "transcriber" &&
              enabledFeatures.includes("transcriber") && (
                <TabContent key="transcriber">
                  <RouteErrorBoundary>
                    <Suspense fallback={SuspenseFallback}>
                      <Transcriber />
                    </Suspense>
                  </RouteErrorBoundary>
                </TabContent>
              )}

            {activeTab === "roadmap" && (
              <TabContent key="roadmap">
                <RouteErrorBoundary>
                  <Suspense fallback={SuspenseFallback}>
                    <Roadmap />
                  </Suspense>
                </RouteErrorBoundary>
              </TabContent>
            )}

            {activeTab === "video" &&
              (enabledFeatures.includes("videos") ||
                enabledFeatures.includes("images")) && (
              <TabContent key="video" className="flex flex-col h-full">
                <header className="header p-6 shrink-0">
                  <div className="max-w-4xl mx-auto w-full">
                    {/* URL Input */}
                    <div className="card-elevated p-2">
                      <div className="flex gap-2">
                        <div ref={turboMenuRef} className="flex-1 relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400">
                            <IconSearch size={20} />
                          </div>
                          <input
                            ref={inputRef}
                            type="text"
                            value={mediaURL || url}
                            onChange={(e) => {
                              applyUnifiedURL(e.target.value);
                              if (error || authRequired) setError("");
                            }}
                            onPaste={(e) => {
                              const pasted = e.clipboardData.getData("text");
                              if (shouldUseMediaInspector(pasted)) {
                                e.preventDefault();
                                applyUnifiedURL(pasted);
                              } else {
                                onPasteEvent(pasted);
                              }
                            }}
                            placeholder={t("home.paste_url")}
                            className={`w-full bg-transparent border-none py-3 pl-12 text-surface-900 placeholder:text-surface-400 focus:ring-0 text-base font-medium ${
                              mediaURL || url ? "pr-24" : "pr-24 sm:pr-44"
                            }`}
                          />
                          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                            {/* Paste Button */}
                            {!mediaURL && !url && (
                              <button
                                onClick={handleUnifiedPaste}
                                type="button"
                                className="p-2 text-surface-400 hover:text-surface-900 dark:hover:text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-200 rounded-lg transition-colors text-xs font-bold flex items-center gap-2"
                              >
                                <IconClipboard
                                  size={18}
                                  className="sm:hidden"
                                />
                                <span className="hidden sm:inline">
                                  {t("home.paste")}
                                </span>
                                <kbd className="hidden sm:inline-flex items-center rounded border border-surface-200 bg-surface-50 px-1.5 py-0.5 font-mono text-[10px] leading-none text-surface-500 dark:border-surface-300 dark:bg-surface-200/50 dark:text-surface-500">
                                  {pasteShortcut}
                                </kbd>
                              </button>
                            )}
                            {/* Clear Button */}
                            {(mediaURL || url) && (
                              <button
                                type="button"
                                onClick={clearUrl}
                                aria-label={t("home.clear_url")}
                                className="rounded-full p-1.5 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700 dark:hover:bg-surface-200"
                              >
                                <IconX size={18} />
                              </button>
                            )}
                            <div className="ml-1 border-l border-surface-200 pl-2 dark:border-surface-300">
                              <button
                                type="button"
                                onClick={() =>
                                  setTurboMenuOpen((open) => !open)
                                }
                                aria-expanded={turboMenuOpen}
                                aria-controls="quick-download-settings"
                                aria-label={t("home.turbo_quick_title")}
                                title={t("home.turbo_quick_title")}
                                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/30 ${
                                  turboMenuOpen
                                    ? "bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-500"
                                    : "text-surface-400 hover:bg-surface-100 hover:text-surface-700 dark:hover:bg-surface-200 dark:hover:text-surface-700"
                                }`}
                              >
                                <IconSettings size={19} />
                              </button>
                            </div>
                          </div>

                          <AnimatePresence>
                            {turboMenuOpen && (
                              <motion.div
                                id="quick-download-settings"
                                role="dialog"
                                aria-modal="false"
                                aria-labelledby="quick-download-settings-title"
                                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                transition={{ duration: 0.16 }}
                                className="absolute right-0 top-full z-50 mt-3 w-[min(22rem,calc(100vw-3rem))] origin-top-right overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-xl dark:border-surface-300 dark:bg-surface-100"
                              >
                                <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-300">
                                  <span
                                    id="quick-download-settings-title"
                                    className="text-sm font-bold text-surface-900 dark:text-surface-800"
                                  >
                                    {t("home.turbo_quick_title")}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setTurboMenuOpen(false)}
                                    aria-label={t("actions.close")}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:hover:bg-surface-200 dark:hover:text-surface-700"
                                  >
                                    <IconX size={17} />
                                  </button>
                                </div>

                                <div className="space-y-4 p-4">
                                  <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-50 px-3 py-3 dark:bg-surface-200/70">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                    <IconRocket
                                      size={18}
                                      className={`shrink-0 ${
                                        useAria2c
                                          ? "text-primary-600 dark:text-primary-500"
                                          : "text-surface-400"
                                      }`}
                                    />
                                    <span
                                      className={
                                        useAria2c
                                          ? "truncate text-sm font-semibold text-primary-700 dark:text-primary-400"
                                          : "truncate text-sm font-semibold text-surface-700 dark:text-surface-600"
                                      }
                                    >
                                      {t(
                                        useAria2c
                                          ? "home.aria2c_active"
                                          : "home.aria2c_inactive",
                                      )}
                                    </span>
                                  </div>
                                  <QuickSettingToggle
                                    checked={useAria2c}
                                    disabled={isCheckingTurbo}
                                    label={t(
                                      useAria2c
                                        ? "home.aria2c_active"
                                        : "home.aria2c_inactive",
                                    )}
                                    onChange={() => void toggleTurbo()}
                                  />
                                  </div>

                                  <AnimatePresence initial={false}>
                                    {useAria2c && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="space-y-4">
                                        <QuickTurboOptions
                                          label={t("home.turbo_connections")}
                                          values={[4, 8, 16, 32]}
                                          selected={aria2cConnections}
                                          onSelect={(value) =>
                                            setSetting(
                                              "aria2cConnections",
                                              value,
                                            )
                                          }
                                        />
                                        <QuickTurboOptions
                                          label={t("home.turbo_fragments")}
                                          values={[2, 4, 8, 16]}
                                          selected={concurrentFragments}
                                          onSelect={(value) =>
                                            setSetting(
                                              "concurrentFragments",
                                              value,
                                            )
                                          }
                                        />
                                      </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>

                                  <div className="space-y-3 border-t border-surface-200 pt-4 dark:border-surface-300">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-surface-500">
                                      {settingsT("downloads.title")}
                                    </p>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-medium text-surface-700 dark:text-surface-600">
                                      {settingsT("downloads.skip_existing")}
                                    </span>
                                    <QuickSettingToggle
                                      checked={skipExisting}
                                      label={settingsT(
                                        "downloads.skip_existing",
                                      )}
                                      onChange={() =>
                                        setSetting(
                                          "skipExisting",
                                          !skipExisting,
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-medium text-surface-700 dark:text-surface-600">
                                      {settingsT("downloads.thumbnail")}
                                    </span>
                                    <QuickSettingToggle
                                      checked={embedThumbnail}
                                      label={settingsT("downloads.thumbnail")}
                                      onChange={() =>
                                        setSetting(
                                          "embedThumbnail",
                                          !embedThumbnail,
                                        )
                                      }
                                    />
                                  </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    {/* Fetching indicator */}
                    {isFetching && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 mt-3 text-sm text-surface-500 justify-center"
                      >
                        <IconLoader2 size={16} className="animate-spin" />
                        <span>{t("home.fetching")}</span>
                      </motion.div>
                    )}

                    {/* Authentication / Error */}
                    <AnimatePresence>
                      {authRequired && (
                        <motion.div
                          key="youtube-auth"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <BrowserAuthPrompt
                            activeBrowser={activeAuthBrowser}
                            failedBrowser={failedAuthBrowser}
                            onRetry={retryWithBrowser}
                          />
                        </motion.div>
                      )}
                      {!authRequired && error && (
                        <motion.div
                          key="video-error"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 rounded-xl text-sm text-red-600 dark:text-red-400 text-center"
                        >
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </header>

                <div className="flex-1 min-h-0 p-6">
                  <div
                    className={`mx-auto grid h-full w-full items-stretch gap-4 ${
                      layout === "sidebar"
                        ? "max-w-[94rem] grid-cols-1 xl:grid-cols-[minmax(6rem,1fr)_minmax(0,60rem)_minmax(6rem,1fr)]"
                        : "max-w-[100rem] grid-cols-1 xl:grid-cols-[minmax(7rem,1fr)_minmax(0,60rem)_minmax(7rem,1fr)]"
                    }`}
                  >
                    <div className="hidden h-[90%] w-[90%] self-start justify-self-center xl:block">
                      <DonationBanner
                        variant="rail"
                        eyebrow={t("donation.sidebar.eyebrow")}
                        title={t("donation.sidebar.title")}
                        description={t("donation.sidebar.description")}
                        action={t("donation.dashboard.action")}
                      />
                    </div>

                    <div className="min-h-0 min-w-0 overflow-y-auto [scrollbar-gutter:stable_both-edges] custom-scrollbar">
                    <div className="mx-auto w-full max-w-4xl">
                    <div className="mb-4 xl:hidden">
                      <DonationBanner
                        variant="subtle"
                        eyebrow={t("donation.sidebar.eyebrow")}
                        title={t("donation.sidebar.title")}
                        description={t("donation.sidebar.description")}
                        action={t("donation.dashboard.action")}
                      />
                    </div>
                    {/* Video Content */}
                    <AnimatePresence mode="wait">
                      {mediaURL ? (
                        <motion.div
                          key={`media-${mediaURL}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="mb-6"
                        >
                          <RouteErrorBoundary>
                            <Suspense fallback={SuspenseFallback}>
                              <Images
                                key={mediaURL}
                                initialUrl={mediaURL}
                                embedded
                                onOpenQueue={() => setActiveTab("queue")}
                              />
                            </Suspense>
                          </RouteErrorBoundary>
                        </motion.div>
                      ) : videoInfo ? (
                        <motion.div
                          key="video-options"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="card p-6 mb-6"
                        >
                          {/* Video Preview */}
                          <div className="flex gap-5 mb-6">
                            <div className="w-48 h-28 rounded-xl overflow-hidden flex-shrink-0 relative bg-surface-100">
                              {videoInfo.thumbnail ? (
                                <img
                                  src={videoInfo.thumbnail}
                                  alt={videoInfo.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = "none";
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-surface-400">
                                  <IconVideo size={32} />
                                </div>
                              )}
                              <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded">
                                {formatDuration(videoInfo.duration)}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 py-1">
                              <h2 className="text-xl font-bold text-surface-900 mb-2 line-clamp-2 leading-tight">
                                {videoInfo.title}
                              </h2>
                              <div className="flex items-center gap-2 text-sm text-surface-500">
                                <span className="font-medium">
                                  {videoInfo.uploader}
                                </span>
                                <span>•</span>
                                <span>
                                  {formatViews(videoInfo.view_count)}{" "}
                                  {t("home.views")}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Mode Selector */}
                          <div className="flex items-center gap-4 mb-6 p-1 bg-surface-100 dark:bg-surface-200/50 rounded-xl w-fit">
                            <button
                              onClick={() => setDownloadMode("video")}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                downloadMode === "video"
                                  ? "bg-white dark:bg-surface-200 text-surface-900 dark:text-surface-800 shadow-sm"
                                  : "text-surface-500 hover:text-surface-900 dark:hover:text-surface-400"
                              }`}
                            >
                              <IconVideo size={16} />
                              {t("home.video")}
                            </button>
                            <button
                              onClick={() => setDownloadMode("audio")}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                downloadMode === "audio"
                                  ? "bg-white dark:bg-surface-200 text-surface-900 dark:text-surface-800 shadow-sm"
                                  : "text-surface-500 hover:text-surface-900 dark:hover:text-surface-400"
                              }`}
                            >
                              <IconMusic size={16} />
                              {t("home.audio")}
                            </button>
                          </div>

                          {/* Video Quality Options */}
                          {downloadMode === "video" && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mb-5"
                            >
                              <label className="block text-sm font-medium text-surface-700 dark:text-surface-400 mb-2">
                                {t("home.quality")}
                              </label>
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {availableQualities.map((q) => {
                                  const Icon = q.icon;
                                  return (
                                    <button
                                      key={q.value}
                                      onClick={() =>
                                        setSelectedQuality(q.value)
                                      }
                                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                                        selectedQuality === q.value
                                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-100"
                                          : "border-surface-200 dark:border-surface-300 hover:border-surface-300 text-surface-700 dark:text-surface-500"
                                      }`}
                                    >
                                      <Icon size={18} />
                                      <span className="font-medium">
                                        {q.label}
                                      </span>
                                      <span className="text-xs opacity-70">
                                        {q.desc}
                                      </span>
                                      {q.recommended &&
                                        selectedQuality === q.value && (
                                          <span className="text-xs bg-primary-200 dark:bg-primary-800 px-1.5 py-0.5 rounded">
                                            ★
                                          </span>
                                        )}
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}

                          {/* Audio Format Options */}
                          {downloadMode === "audio" && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mb-5"
                            >
                              <label className="block text-sm font-medium text-surface-700 dark:text-surface-400 mb-2">
                                {t("home.format")}
                              </label>
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {AUDIO_FORMATS.map((f) => {
                                  const Icon = f.icon;
                                  return (
                                    <button
                                      key={f.value}
                                      onClick={() =>
                                        setSelectedAudioFormat(f.value)
                                      }
                                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                                        selectedAudioFormat === f.value
                                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-100"
                                          : "border-surface-200 dark:border-surface-300 hover:border-surface-300 text-surface-700 dark:text-surface-500"
                                      }`}
                                    >
                                      <Icon size={18} />
                                      <span className="font-medium">
                                        {f.label}
                                      </span>
                                      <span className="text-xs opacity-70">
                                        {f.desc}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}

                          {/* Video Trimmer — isolated state, won't re-render parent */}
                          {videoInfo.duration > 0 && (
                            <div className="mb-5 pt-5 border-t border-surface-100 dark:border-surface-300">
                              <VideoTrimmer
                                videoUrl={streamUrl}
                                duration={videoInfo.duration}
                                onCutsChange={handleCutsChange}
                                onTrimToggle={handleTrimToggle}
                                trimEnabled={trimEnabled}
                                onStreamError={handleStreamError}
                                sourceUrl={url}
                                captions={captions}
                                onCaptionsChange={handleCaptionsChange}
                                subtitleLanguages={videoInfo.subtitle_languages || []}
                                videoLanguage={videoInfo.language || ""}
                              />
                            </div>
                          )}

                          {/* Download Button */}
                          <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={handleDownload}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                          >
                            {isLoading ? (
                              <IconLoader2 size={20} className="animate-spin" />
                            ) : (
                              <>
                                <IconDownload size={20} />
                                <span>
                                  {downloadMode === "video"
                                    ? t("home.add_queue")
                                    : t("home.add_audio_queue")}
                                </span>
                              </>
                            )}
                          </motion.button>
                        </motion.div>
                      ) : isFetching ? (
                        <div className="mt-8">
                          <div className="bg-surface-50/50 dark:bg-surface-50/50 rounded-3xl p-6 border border-surface-200 dark:border-surface-300">
                            <div className="flex flex-col md:flex-row gap-8">
                              <Skeleton className="w-full md:w-64 h-40 rounded-2xl shrink-0" />
                              <div className="flex-1 space-y-4 py-2">
                                <Skeleton className="h-8 w-3/4 rounded-lg" />
                                <Skeleton className="h-4 w-1/2 rounded-lg" />
                                <div className="flex gap-2 pt-4">
                                  <Skeleton className="h-10 w-24 rounded-lg" />
                                  <Skeleton className="h-10 w-24 rounded-lg" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Empty State / Queue Summary for Video Tab
                        <motion.div
                          key="queue-link"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="mt-8"
                        >
                          {queue.length > 0 ? (
                            <div className="text-center p-8 bg-surface-50/50 dark:bg-surface-50/50 rounded-2xl border border-surface-200 dark:border-surface-300">
                              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-600 dark:text-primary-400">
                                <IconList size={32} />
                              </div>
                              <h3 className="text-lg font-bold text-surface-900 mb-1">
                                {t("home.active_downloads", {
                                  count: queue.length,
                                })}
                              </h3>
                              <p className="text-surface-500 mb-6 text-sm">
                                {t("home.check_progress")}
                              </p>
                              <button
                                onClick={() => setActiveTab("queue")}
                                className="btn btn-primary px-6"
                              >
                                {t("home.go_to_queue")}
                              </button>
                            </div>
                          ) : (
                            <div className="empty-state">
                              <motion.div
                                className="empty-state-icon"
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 3, repeat: Infinity }}
                              >
                                <IconCloud
                                  size={32}
                                  className="text-surface-300 dark:text-surface-600"
                                />
                              </motion.div>
                              <h3 className="empty-state-title">
                                {t("home.empty_queue_title")}
                              </h3>
                              <p className="empty-state-text">
                                {t("home.empty_queue_text")}
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    </div>
                    </div>

                    <div className="hidden h-[90%] w-[90%] self-start justify-self-center xl:block">
                      <DonationBanner
                        variant="rail"
                        eyebrow={t("donation.sidebar.eyebrow")}
                        title={t("donation.sidebar.title")}
                        description={t("donation.sidebar.description")}
                        action={t("donation.dashboard.action")}
                      />
                    </div>
                  </div>
                </div>
              </TabContent>
            )}

            {activeTab === "queue" && (
              <TabContent key="queue">
                <QueueList queue={queue} />
              </TabContent>
            )}

            {activeTab === "history" && (
              <TabContent key="history">
                <div className="flex-1 min-h-0 p-6 overflow-y-auto overscroll-y-contain custom-scrollbar">
                  <HistoryView />
                </div>
              </TabContent>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Footer Terminal (Docked) - Escondido no Roadmap */}
      {activeTab !== "roadmap" && <Terminal layout={layout} />}
      {/* Settings Panel Overlay */}
      <SettingsPanel
        isOpen={settingsState.isOpen}
        onClose={closeSettings}
        defaultTab={settingsState.tab}
        scrollToId={settingsState.targetId}
      />
    </div>
  );
}
