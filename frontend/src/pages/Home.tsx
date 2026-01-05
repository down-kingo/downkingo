import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  safeWindowSetDarkTheme,
  safeWindowSetLightTheme,
} from "../lib/wailsRuntime";
import { useDownloadStore, Download } from "../stores/downloadStore";
import { useDownloadSync } from "../hooks/useDownloadSync";
import { useSettingsStore } from "../stores/settingsStore";
import { translations } from "../translations";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import Settings from "../components/Settings";
import SettingsPanel from "../components/SettingsPanel";
import Terminal from "../components/Terminal";
import ClipboardToast from "../components/ClipboardToast";
import DisclaimerModal from "../components/DisclaimerModal";
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
} from "../../wailsjs/go/main/App";
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
} from "@tabler/icons-react";

export default function Home() {
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
  } = useSettingsStore();
  const t = translations[language];

  // Gerar formatos baseados na compatibilidade selecionada
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts({
    onOpenSettings: () => setIsSettingsOpen(true),
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

  // Fetch video info when URL changes (with debounce)
  useEffect(() => {
    if (!url.trim()) {
      setVideoInfo(null);
      return;
    }

    if (
      !url.includes("youtube.com") &&
      !url.includes("youtu.be") &&
      !url.includes("tiktok.com") &&
      !url.includes("instagram.com")
    ) {
      return;
    }

    const timer = setTimeout(() => {
      fetchVideoInfo();
    }, 800);

    return () => clearTimeout(timer);
  }, [url]);

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

  const getStatusBadge = (download: Download) => {
    const badges: Record<string, JSX.Element> = {
      pending: (
        <span className="badge badge-pending">
          <span className="w-1.5 h-1.5 rounded-full bg-surface-400" />
          Na fila
        </span>
      ),
      downloading: (
        <span className="badge badge-downloading">
          {download.progress.toFixed(0)}%
        </span>
      ),
      merging: <span className="badge badge-downloading">Processando</span>,
      completed: (
        <span className="badge badge-completed">
          <IconCheck size={14} />
          Concluído
        </span>
      ),
      failed: (
        <span className="badge badge-failed">
          <IconX size={14} />
          Erro
        </span>
      ),
      cancelled: <span className="badge badge-pending">Cancelado</span>,
    };
    return badges[download.status] || null;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-50 dark:bg-surface-50 text-surface-900 transition-colors duration-300">
      <ClipboardToast />
      <DisclaimerModal onAccept={() => {}} />

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
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : (
          <Topbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            queueCount={queue.length}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {/* Main Content Wrapper */}
        <main className="flex-1 flex flex-col overflow-hidden relative w-full">
          {activeTab === "home" ? (
            <Dashboard onNavigate={setActiveTab} />
          ) : activeTab === "images" ? (
            <div className="flex-1 overflow-y-auto p-8 bg-surface-50 dark:bg-surface-950">
              <Images />
            </div>
          ) : activeTab === "converter" ? (
            <Converter />
          ) : activeTab === "roadmap" ? (
            <Roadmap />
          ) : (
            <>
              {/* Header with Input - Only for Video */}
              {activeTab === "video" && (
                <header className="header p-6">
                  <div className="max-w-4xl mx-auto">
                    {/* URL Input */}
                    <div className="card-elevated p-2">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400">
                            <IconSearch size={20} />
                          </div>
                          <input
                            ref={inputRef}
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder={t.home.placeholder}
                            className="input input-lg pl-12 pr-12 focus:ring-0"
                            disabled={isLoading}
                          />
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

                    {/* Fetching indicator */}
                    {isFetching && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 mt-3 text-sm text-surface-500"
                      >
                        <IconLoader2 size={16} className="animate-spin" />
                        <span>{t.home.fetching}</span>
                      </motion.div>
                    )}

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 rounded-xl text-sm text-red-600 dark:text-red-400"
                        >
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </header>
              )}

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                  {/* Video Preview & Options - Only if activeTab is video */}
                  <AnimatePresence mode="wait">
                    {activeTab === "video" && videoInfo && (
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
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                  (
                                    e.target as HTMLImageElement
                                  ).parentElement?.classList.add(
                                    "flex",
                                    "items-center",
                                    "justify-center"
                                  );
                                }}
                              />
                            ) : null}
                            <div className="absolute inset-0 flex items-center justify-center -z-10">
                              <IconVideo
                                size={32}
                                className="text-surface-300"
                              />
                            </div>
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded z-10">
                              {formatDuration(videoInfo.duration)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-surface-900 text-lg line-clamp-2 leading-snug">
                              {videoInfo.title}
                            </h3>
                            <p className="text-sm text-surface-500 mt-2">
                              {videoInfo.uploader}
                            </p>
                            {videoInfo.view_count > 0 && (
                              <p className="text-xs text-surface-400 mt-1">
                                {formatViews(videoInfo.view_count)}{" "}
                                visualizações
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Mode Selector */}
                        <div className="flex gap-2 p-1 bg-surface-100 dark:bg-surface-200 rounded-xl mb-5">
                          <button
                            onClick={() => setDownloadMode("video")}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-all ${
                              downloadMode === "video"
                                ? "bg-white dark:bg-surface-100 text-surface-900 shadow-sm"
                                : "text-surface-600 hover:text-surface-900"
                            }`}
                          >
                            <IconVideo size={18} />
                            <span>{t.home.video_mode}</span>
                          </button>
                          <button
                            onClick={() => setDownloadMode("audio")}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-all ${
                              downloadMode === "audio"
                                ? "bg-white dark:bg-surface-100 text-surface-900 shadow-sm"
                                : "text-surface-600 hover:text-surface-900"
                            }`}
                          >
                            <IconMusic size={18} />
                            <span>{t.home.audio_mode}</span>
                          </button>
                        </div>

                        {/* Video Quality Options */}
                        {downloadMode === "video" && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mb-5"
                          >
                            <label className="block text-sm font-medium text-surface-700 mb-2">
                              {t.home.quality}
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
                                    onClick={() => setSelectedQuality(q.value)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                                      selectedQuality === q.value
                                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900 text-primary-700 dark:text-primary-100"
                                        : "border-surface-200 dark:border-surface-700 hover:border-surface-300 text-surface-700 dark:text-surface-300"
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
                            <label className="block text-sm font-medium text-surface-700 mb-2">
                              {t.home.format}
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
                                        : "border-surface-200 dark:border-surface-700 hover:border-surface-300 text-surface-700 dark:text-surface-300"
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
                                  ? t.home.add_queue
                                  : t.home.add_audio_queue}
                              </span>
                            </>
                          )}
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Queue Summary / Empty State */}
                  <AnimatePresence mode="wait">
                    {activeTab === "video" ? (
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
                              {queue.length} downloads em andamento
                            </h3>
                            <p className="text-surface-500 mb-6 text-sm">
                              Acompanhe o progresso na aba dedicada.
                            </p>
                            <button
                              onClick={() => setActiveTab("queue")}
                              className="btn btn-primary px-6"
                            >
                              Ir para a Fila
                            </button>
                          </div>
                        ) : !videoInfo ? (
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
                              {t.home.empty_queue_title}
                            </h3>
                            <p className="empty-state-text">
                              {t.home.empty_queue_text}
                            </p>
                          </div>
                        ) : null}
                      </motion.div>
                    ) : activeTab === "history" ? (
                      <motion.div
                        key="history"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                      >
                        {history.length > 0 ? (
                          <>
                            <div className="flex items-center justify-between mb-4">
                              <h2 className="text-lg font-bold font-display text-surface-900">
                                {t.home.history_title}
                              </h2>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-surface-500">
                                  {history.length} downloads
                                </span>
                                <button
                                  onClick={clearHistory}
                                  className="p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Limpar Histórico"
                                >
                                  <IconTrash size={16} />
                                </button>
                              </div>
                            </div>
                            <div className="space-y-3">
                              {history.slice(0, 20).map((download, index) => (
                                <motion.div
                                  key={download.id}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.03 }}
                                  className="video-card"
                                >
                                  <div className="flex">
                                    <div className="w-32 h-20 bg-surface-100 flex-shrink-0 relative overflow-hidden rounded-l-2xl flex items-center justify-center">
                                      {download.thumbnail ? (
                                        <img
                                          src={download.thumbnail}
                                          alt={download.title}
                                          className="video-thumbnail absolute inset-0 w-full h-full object-cover"
                                          onError={(e) => {
                                            (
                                              e.target as HTMLImageElement
                                            ).style.display = "none";
                                          }}
                                        />
                                      ) : null}
                                      <IconVideo
                                        size={20}
                                        className="text-surface-300"
                                      />
                                    </div>
                                    <div className="flex-1 p-3 flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-surface-900 truncate text-sm">
                                          {download.title}
                                        </h3>
                                        <p className="text-xs text-surface-500 mt-0.5">
                                          {download.uploader}
                                        </p>
                                      </div>
                                      {getStatusBadge(download)}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-2 justify-center pr-3 border-l border-surface-200/50 pl-3 ml-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          OpenDownloadFolder(download.id);
                                        }}
                                        className="p-1.5 text-surface-400 hover:text-primary-500 hover:bg-surface-200/50 rounded-lg transition-colors"
                                        title={t.actions.openFolder}
                                      >
                                        <IconFolder size={18} />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          OpenUrl(download.url);
                                        }}
                                        className="p-1.5 text-surface-400 hover:text-secondary-500 hover:bg-surface-200/50 rounded-lg transition-colors"
                                        title={t.actions.openUrl}
                                      >
                                        <IconWorld size={18} />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="empty-state">
                            <div className="empty-state-icon">
                              <IconHistory
                                size={32}
                                className="text-surface-300 dark:text-surface-600"
                              />
                            </div>
                            <h3 className="empty-state-title">
                              {t.home.empty_history_title}
                            </h3>
                            <p className="empty-state-text">
                              {t.home.empty_history_text}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}

          {activeTab === "queue" && <QueueList queue={queue} />}
        </main>
      </div>

      {/* Footer Terminal (Docked) */}
      <Terminal layout={layout} />
      {/* Settings Panel Overlay */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
