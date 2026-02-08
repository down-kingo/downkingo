import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  safeWindowSetDarkTheme,
  safeWindowSetLightTheme,
} from "../lib/wailsRuntime";
import { useDownloadStore, Download } from "../stores/downloadStore";
import { useDownloadSync } from "../hooks/useDownloadSync";
import { shallow } from "zustand/shallow";
import { useSettingsStore } from "../stores/settingsStore";
import { useTranslation } from "react-i18next";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useDebounce } from "../hooks/useDebounce";
import SettingsPanel, { SettingsTab } from "../components/SettingsPanel";
import Terminal from "../components/Terminal";
import ClipboardToast from "../components/ClipboardToast";
import OnboardingModal from "../components/OnboardingModal";
import QueueList from "../components/QueueList";
import { Sidebar, Topbar, TabType } from "../components/navigation";
import {
  getVideoQualities,
  AUDIO_FORMATS,
  VideoInfo,
} from "../components/video";
import Images from "./Images";
import Converter from "./Converter";
import Roadmap from "./Roadmap";
import Dashboard from "./Dashboard";
import { HistoryView } from "../components/HistoryView";
import { Skeleton } from "../components/Skeleton";
import { TabContent } from "../components/TabContent";
import {
  GetDownloadsPath,
  GetVersion,
  GetVideoInfo,
  AddToQueueAdvanced,
  UpdateYtDlp,
  CheckForUpdate,
  InstallAppVersion,
  RestartApp,
  OpenDownloadFolder,
  OpenUrl,
  CheckAria2cStatus,
  DownloadAria2c,
} from "../../bindings/kingo/app";
import {
  IconDownload,
  IconHistory,
  IconFolder,
  IconCheck,
  IconX,
  IconMusic,
  IconVideo,
  IconCloud,
  IconLoader2,
  IconRefresh,
  IconDeviceTv,
  IconDeviceMobile,
  IconFileMusic,
  IconBrandApple,
  IconVinyl,
  IconSearch,
  IconSettings,
  IconTrash,
  IconPhoto,
  IconHome,
  IconWorld,
  IconExternalLink,
  IconList,
  IconTransform,
  IconRocket,
  IconBolt,
  IconArrowRight,
} from "@tabler/icons-react";

export default function Home() {
  const settings = useSettingsStore(
    (state) => ({
      theme: state.theme,
      layout: state.layout,
      primaryColor: state.primaryColor,
      language: state.language,
      anonymousMode: state.anonymousMode,
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
    }),
    shallow
  );

  const {
    theme,
    layout,
    primaryColor,
    language,
    anonymousMode,
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
  } = settings;
  const { t } = useTranslation("common");

  const VIDEO_QUALITIES = getVideoQualities(videoCompatibility);

  const [url, setUrl] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState("");
  const [downloadsPath, setDownloadsPath] = useState("");
  const [version, setVersion] = useState("");

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("home");

  // Settings panel state
  const [settingsState, setSettingsState] = useState<{
    isOpen: boolean;
    tab?: SettingsTab;
    targetId?: string;
  }>({ isOpen: false });

  const openSettings = (tab: SettingsTab = "general", targetId?: string) => {
    setSettingsState({ isOpen: true, tab, targetId });
  };

  const closeSettings = () => {
    setSettingsState((prev) => ({ ...prev, isOpen: false }));
  };

  const inputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({
    onOpenSettings: () => openSettings(),
    onFocusInput: () => {
      setActiveTab("video");
      setTimeout(() => inputRef.current?.focus(), 50);
    },
  });

  // Listen for clipboard fill events (local custom event)
  useEffect(() => {
    const handleFillUrl = (event: CustomEvent) => {
      const detectedUrl = event.detail;
      if (detectedUrl) {
        setUrl(detectedUrl);
        setActiveTab("video");
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };

    window.addEventListener(
      "kinematic:fill-url",
      handleFillUrl as EventListener
    );
    return () => {
      window.removeEventListener(
        "kinematic:fill-url",
        handleFillUrl as EventListener
      );
    };
  }, []);

  // Video info state
  const [downloadMode, setDownloadMode] = useState<"video" | "audio">("video");
  const [selectedQuality, setSelectedQuality] = useState(
    getVideoQualities("universal")[1].value
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
            console.log("Update disponível:", info.latestVersion);
            InstallAppVersion(info.latestVersion)
              .then(() => {
                RestartApp();
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [autoUpdateYtDlp, ytDlpChannel, autoUpdateApp]);

  const { queue, history } = useDownloadStore();
  const { cancelDownload, refresh, clearHistory } = useDownloadSync();

  // Apply Theme and Colors
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    document.documentElement.setAttribute("data-color", primaryColor);

    if (theme === "dark") {
      safeWindowSetDarkTheme();
    } else {
      safeWindowSetLightTheme();
    }
  }, [theme, primaryColor]);

  useEffect(() => {
    GetDownloadsPath().then(setDownloadsPath);
    GetVersion().then(setVersion);
  }, []);
  // Debounce hook
  const debouncedUrl = useDebounce(url, 800);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        if (error) setError("");
        // Opcional: focar no input se referência existir e estiver acessível
        // inputRef.current?.focus();
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  // Fetch video info when debounced URL changes
  useEffect(() => {
    if (!debouncedUrl.trim()) {
      setVideoInfo(null);
      return;
    }

    if (
      !debouncedUrl.includes("youtube.com") &&
      !debouncedUrl.includes("youtu.be") &&
      !debouncedUrl.includes("tiktok.com") &&
      !debouncedUrl.includes("instagram.com")
    ) {
      return;
    }

    fetchVideoInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedUrl]);

  const fetchVideoInfo = async () => {
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
  };

  // Auto-select best available quality
  useEffect(() => {
    if (!videoInfo || !videoInfo.formats) return;

    const maxH = Math.max(...videoInfo.formats.map((f) => f.height || 0));

    const bestFit = VIDEO_QUALITIES.find((q) => maxH >= (q.minHeight || 0));

    if (bestFit) {
      const currentOption = VIDEO_QUALITIES.find(
        (q) => q.value === selectedQuality
      );
      const currentIsAvailable =
        currentOption && maxH >= (currentOption.minHeight || 0);

      if (!currentIsAvailable) {
        setSelectedQuality(bestFit.value);
      }
    }
  }, [videoInfo, VIDEO_QUALITIES, selectedQuality]);

  const handleDownload = async () => {
    if (!url.trim() || !videoInfo) return;
    setIsLoading(true);
    setError("");

    try {
      await AddToQueueAdvanced({
        url,
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
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
        incognito: anonymousMode,
        useAria2c: useAria2c,
        aria2cConnections: aria2cConnections,
      });
      setUrl("");
      setVideoInfo(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const clearUrl = () => {
    setUrl("");
    setVideoInfo(null);
    setError("");
  };

  const formatDuration = (seconds: number) => {
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
  };

  const formatViews = (count: number) => {
    if (!count) return "";
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-50 dark:bg-surface-50 text-surface-900 transition-colors duration-300">
      <ClipboardToast />
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
                <Dashboard onNavigate={setActiveTab} />
              </TabContent>
            )}

            {activeTab === "images" && (
              <TabContent key="images">
                <div className="flex-1 overflow-y-auto p-8 bg-surface-50 dark:bg-surface-950">
                  <Images />
                </div>
              </TabContent>
            )}

            {activeTab === "converter" && (
              <TabContent key="converter">
                <Converter />
              </TabContent>
            )}

            {activeTab === "roadmap" && (
              <TabContent key="roadmap">
                <Roadmap />
              </TabContent>
            )}

            {activeTab === "video" && (
              <TabContent key="video" className="flex flex-col h-full">
                <header className="header p-6 shrink-0">
                  <div className="max-w-4xl mx-auto w-full">
                    {/* URL Input */}
                    <div className="card-elevated p-2">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400">
                            <IconSearch size={20} />
                          </div>
                          <input
                            ref={inputRef}
                            type="text"
                            value={url}
                            onChange={(e) => {
                              setUrl(e.target.value);
                              if (error) setError("");
                            }}
                            placeholder={t("home.paste_url")}
                            className="w-full bg-transparent border-none py-3 pl-12 pr-10 text-surface-900 placeholder:text-surface-400 focus:ring-0 text-base font-medium"
                          />
                          {/* Paste Button */}
                          {!url && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <button
                                onClick={handlePaste}
                                type="button"
                                className="p-2 text-surface-400 hover:text-surface-900 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors text-xs font-bold flex items-center gap-2"
                              >
                                <span className="hidden sm:inline">
                                  {t("home.paste")}
                                </span>
                                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-200/50 text-[10px] font-mono text-surface-500 dark:text-surface-400">
                                  <span className="text-xs">⌘</span>V
                                </kbd>
                              </button>
                            </div>
                          )}
                          {/* Clear Button */}
                          {url && (
                            <button
                              onClick={clearUrl}
                              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-surface-100 dark:hover:bg-surface-200 rounded-full transition-colors"
                            >
                              <IconX size={18} className="text-surface-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Aria2c Active Warning - Minimalist Pill */}
                    <AnimatePresence>
                      {useAria2c && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="flex justify-center mt-6"
                        >
                          <div className="inline-flex items-center gap-2 bg-surface-100/80 dark:bg-surface-800/50 backdrop-blur-sm border border-surface-200 dark:border-surface-200/30 rounded-full px-4 py-1.5 shadow-sm">
                            <IconRocket
                              size={14}
                              className="text-orange-500 dark:text-orange-400"
                            />
                            <span className="text-xs font-bold text-surface-600 dark:text-surface-500 uppercase tracking-widest">
                              {t("home.aria2c_active")}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Turbo Mode Promotion - Show if NOT active */}
                    <AnimatePresence>
                      {!useAria2c && !url && !videoInfo && !isFetching && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="mt-6 max-w-sm mx-auto"
                        >
                          <div className="inline-flex flex-col sm:flex-row items-center gap-3 bg-surface-100/80 dark:bg-surface-800/50 backdrop-blur-sm border border-surface-200 dark:border-surface-200/30 rounded-full py-2 pl-4 pr-3 shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="text-orange-500 dark:text-orange-400 animate-pulse">
                                <IconBolt size={16} fill="currentColor" />
                              </div>
                              <span className="text-sm font-medium text-surface-600 dark:text-surface-500">
                                {t("home.turbo_tip_title")}
                              </span>
                            </div>

                            <div className="hidden sm:block w-px h-4 bg-surface-300 dark:bg-surface-200" />
                            <button
                              onClick={() =>
                                openSettings("video", "aria2c-settings")
                              }
                              className="group flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-surface-200 hover:bg-surface-50 dark:hover:bg-surface-300 text-surface-900 dark:text-surface-600 text-xs font-bold rounded-full shadow-sm border border-surface-200 dark:border-surface-200/50 transition-all"
                            >
                              <span>{t("home.turbo_activate")}</span>
                              <IconArrowRight
                                size={12}
                                className="group-hover:translate-x-0.5 transition-transform"
                              />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

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

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
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

                <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
                  <div className="max-w-4xl mx-auto">
                    {/* Video Content */}
                    <AnimatePresence mode="wait">
                      {videoInfo ? (
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
                          <div className="flex items-center gap-4 mb-6 p-1 bg-surface-100 dark:bg-surface-800/50 rounded-xl w-fit">
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
                              <div className="flex flex-wrap gap-2">
                                {VIDEO_QUALITIES.filter((q) => {
                                  const maxH = videoInfo?.formats
                                    ? Math.max(
                                        ...videoInfo.formats.map(
                                          (f) => f.height || 0
                                        )
                                      )
                                    : 0;
                                  return maxH >= (q.minHeight || 0);
                                }).map((q) => {
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
                                          : "border-surface-200 dark:border-surface-700 hover:border-surface-300 text-surface-700 dark:text-surface-400"
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
                              <div className="flex flex-wrap gap-2">
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
                                          : "border-surface-200 dark:border-surface-700 hover:border-surface-300 text-surface-700 dark:text-surface-400"
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
                          <div className="bg-surface-50/50 dark:bg-surface-900/50 rounded-3xl p-6 border border-surface-200 dark:border-surface-800">
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
                            <div className="text-center p-8 bg-surface-50/50 dark:bg-surface-900/50 rounded-2xl border border-surface-200 dark:border-surface-800">
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
              </TabContent>
            )}

            {activeTab === "queue" && (
              <TabContent key="queue">
                <QueueList queue={queue} />
              </TabContent>
            )}

            {activeTab === "history" && (
              <TabContent key="history" className="p-6 overflow-y-auto">
                <HistoryView />
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
