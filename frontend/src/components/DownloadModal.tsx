import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GetVideoInfo } from "../../bindings/kingo/app";
import {
  IconVideo,
  IconMusic,
  IconDownload,
  IconX,
  IconPlayerPlay,
  IconDeviceTv,
  IconDeviceMobile,
  IconPhoto,
  IconWifi,
  IconFileTypeDoc,
  IconFileMusic,
  IconBrandApple,
  IconWaveSine,
  IconVinyl,
  IconDisc,
  IconSubtitles,
} from "@tabler/icons-react";

interface DownloadModalProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
  onDownload: (options: DownloadOptions) => void;
}

export interface DownloadOptions {
  url: string;
  format: string;
  quality: string;
  audioOnly: boolean;
  audioFormat: string;
  audioBitrate: string;
  downloadSubtitles: boolean;
  subtitleLanguage: string;
}

interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
  view_count: number;
  formats: Format[];
}

interface Format {
  format_id: string;
  ext: string;
  resolution: string;
  filesize: number;
  vcodec: string;
  acodec: string;
  quality: string;
}

// Quality presets with Tabler icons
const VIDEO_QUALITIES = [
  {
    value: "bestvideo[height<=2160]+bestaudio/best[height<=2160]",
    label: "4K (2160p)",
    icon: IconPlayerPlay,
    desc: "Ultra HD",
  },
  {
    value: "bestvideo[height<=1440]+bestaudio/best[height<=1440]",
    label: "2K (1440p)",
    icon: IconDeviceTv,
    desc: "Quad HD",
  },
  {
    value: "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
    label: "Full HD (1080p)",
    icon: IconDeviceTv,
    desc: "Recomendado",
    recommended: true,
  },
  {
    value: "bestvideo[height<=720]+bestaudio/best[height<=720]",
    label: "HD (720p)",
    icon: IconDeviceMobile,
    desc: "Boa qualidade",
  },
  {
    value: "bestvideo[height<=480]+bestaudio/best[height<=480]",
    label: "SD (480p)",
    icon: IconPhoto,
    desc: "Tamanho menor",
  },
  {
    value: "bestvideo[height<=360]+bestaudio/best[height<=360]",
    label: "Low (360p)",
    icon: IconWifi,
    desc: "Economia de dados",
  },
];

const AUDIO_FORMATS = [
  { value: "mp3", label: "MP3", desc: "Mais compatível", icon: IconFileMusic },
  {
    value: "m4a",
    label: "M4A/AAC",
    desc: "Boa qualidade",
    icon: IconBrandApple,
  },
  {
    value: "opus",
    label: "Opus",
    desc: "Melhor compressão",
    icon: IconWaveSine,
  },
  { value: "flac", label: "FLAC", desc: "Sem perdas", icon: IconVinyl },
  { value: "wav", label: "WAV", desc: "Sem compressão", icon: IconDisc },
];

const AUDIO_BITRATES = [
  { value: "320", label: "320 kbps", desc: "Máxima qualidade" },
  { value: "256", label: "256 kbps", desc: "Alta qualidade" },
  { value: "192", label: "192 kbps", desc: "Boa qualidade" },
  { value: "128", label: "128 kbps", desc: "Qualidade padrão" },
  { value: "96", label: "96 kbps", desc: "Economia de espaço" },
];

const SUBTITLE_LANGUAGES = [
  { value: "pt", label: "Português" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "zh", label: "中文" },
];

export default function DownloadModal({
  isOpen,
  url,
  onClose,
  onDownload,
}: DownloadModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"video" | "audio">("video");

  // Options state
  const [quality, setQuality] = useState(VIDEO_QUALITIES[2].value);
  const [audioFormat, setAudioFormat] = useState("mp3");
  const [audioBitrate, setAudioBitrate] = useState("320");
  const [downloadSubtitles, setDownloadSubtitles] = useState(false);
  const [subtitleLanguage, setSubtitleLanguage] = useState("pt-BR");

  useEffect(() => {
    if (isOpen && url) {
      fetchVideoInfo();
    }
  }, [isOpen, url]);

  const fetchVideoInfo = async () => {
    setIsLoading(true);
    setError("");
    setVideoInfo(null);

    try {
      const info = await GetVideoInfo(url);
      setVideoInfo(info as VideoInfo);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    const options: DownloadOptions = {
      url,
      format: activeTab === "video" ? quality : "bestaudio",
      quality: activeTab === "video" ? quality : audioBitrate,
      audioOnly: activeTab === "audio",
      audioFormat: activeTab === "audio" ? audioFormat : "",
      audioBitrate: activeTab === "audio" ? audioBitrate : "",
      downloadSubtitles,
      subtitleLanguage: downloadSubtitles ? subtitleLanguage : "",
    };
    onDownload(options);
    onClose();
  };

  const formatDuration = (seconds: number) => {
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
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl z-50 overflow-hidden max-h-[80vh] flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-surface-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-display text-surface-900">
                  Opções de Download
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-surface-100 rounded-xl transition-colors"
                >
                  <IconX className="w-5 h-5 text-surface-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Loading State */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4" />
                  <p className="text-surface-600">
                    Buscando informações do vídeo...
                  </p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* Video Info */}
              {videoInfo && (
                <>
                  {/* Video Preview */}
                  <div className="flex gap-4 mb-6 p-4 bg-surface-50 rounded-2xl">
                    <div className="w-40 h-24 rounded-xl overflow-hidden flex-shrink-0 relative">
                      <img
                        src={videoInfo.thumbnail}
                        alt={videoInfo.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-xs rounded">
                        {formatDuration(videoInfo.duration)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-surface-900 line-clamp-2 leading-snug">
                        {videoInfo.title}
                      </h3>
                      <p className="text-sm text-surface-500 mt-1">
                        {videoInfo.uploader}
                      </p>
                      <p className="text-xs text-surface-400 mt-1">
                        {formatViews(videoInfo.view_count)} visualizações
                      </p>
                    </div>
                  </div>

                  {/* Tab Selector */}
                  <div className="flex gap-2 p-1.5 bg-surface-100 rounded-2xl mb-6">
                    <button
                      onClick={() => setActiveTab("video")}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                        activeTab === "video"
                          ? "bg-white text-surface-900 shadow-md"
                          : "text-surface-600 hover:text-surface-900"
                      }`}
                    >
                      <IconVideo size={20} />
                      <span>Vídeo</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("audio")}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                        activeTab === "audio"
                          ? "bg-white text-surface-900 shadow-md"
                          : "text-surface-600 hover:text-surface-900"
                      }`}
                    >
                      <IconMusic size={20} />
                      <span>Apenas Áudio</span>
                    </button>
                  </div>

                  {/* Video Options */}
                  {activeTab === "video" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 mb-2">
                          Qualidade do Vídeo
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {VIDEO_QUALITIES.map((q) => {
                            const Icon = q.icon;
                            return (
                              <button
                                key={q.value}
                                onClick={() => setQuality(q.value)}
                                className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                                  quality === q.value
                                    ? "border-primary-500 bg-primary-50"
                                    : "border-surface-200 hover:border-surface-300 hover:bg-surface-50"
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={`p-1.5 rounded-lg ${
                                      quality === q.value
                                        ? "bg-primary-100 text-primary-600"
                                        : "bg-surface-100 text-surface-600"
                                    }`}
                                  >
                                    <Icon size={18} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-surface-900 truncate">
                                      {q.label}
                                    </div>
                                    <div className="text-[10px] text-surface-500 truncate">
                                      {q.desc}
                                    </div>
                                  </div>
                                  {q.recommended && (
                                    <span className="text-[10px] bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full font-medium">
                                      ★
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Audio Options */}
                  {activeTab === "audio" && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 mb-2">
                          Formato de Áudio
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {AUDIO_FORMATS.map((f) => {
                            const Icon = f.icon;
                            return (
                              <button
                                key={f.value}
                                onClick={() => setAudioFormat(f.value)}
                                className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                                  audioFormat === f.value
                                    ? "border-primary-500 bg-primary-50"
                                    : "border-surface-200 hover:border-surface-300 hover:bg-surface-50"
                                }`}
                              >
                                <div
                                  className={`p-1.5 rounded-lg mb-1.5 inline-block ${
                                    audioFormat === f.value
                                      ? "bg-primary-100 text-primary-600"
                                      : "bg-surface-100 text-surface-600"
                                  }`}
                                >
                                  <Icon size={18} />
                                </div>
                                <div className="font-medium text-sm text-surface-900 truncate">
                                  {f.label}
                                </div>
                                <div className="text-[10px] text-surface-500 truncate">
                                  {f.desc}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-surface-700 mb-2">
                          Qualidade (Bitrate)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {AUDIO_BITRATES.map((b) => (
                            <button
                              key={b.value}
                              onClick={() => setAudioBitrate(b.value)}
                              className={`px-3 py-1.5 rounded-lg border-2 transition-all text-xs font-medium ${
                                audioBitrate === b.value
                                  ? "border-primary-500 bg-primary-50 text-primary-700"
                                  : "border-surface-200 hover:border-surface-300 text-surface-700"
                              }`}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Subtitles */}
                  <div className="mt-6 pt-6 border-t border-surface-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-surface-100">
                          <IconSubtitles
                            size={20}
                            className="text-surface-600"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-surface-700">
                            Baixar Legendas
                          </label>
                          <p className="text-xs text-surface-500">
                            Incluir legendas no idioma selecionado
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDownloadSubtitles(!downloadSubtitles)}
                        className={`relative w-12 h-7 rounded-full transition-colors ${
                          downloadSubtitles
                            ? "bg-primary-500"
                            : "bg-surface-300"
                        }`}
                      >
                        <motion.div
                          animate={{ x: downloadSubtitles ? 22 : 2 }}
                          className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                        />
                      </button>
                    </div>

                    <AnimatePresence>
                      {downloadSubtitles && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <select
                            value={subtitleLanguage}
                            onChange={(e) =>
                              setSubtitleLanguage(e.target.value)
                            }
                            className="w-full p-3 bg-surface-50 border border-surface-200 rounded-xl text-surface-900 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                          >
                            {SUBTITLE_LANGUAGES.map((lang) => (
                              <option key={lang.value} value={lang.value}>
                                {lang.label}
                              </option>
                            ))}
                          </select>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {videoInfo && (
              <div className="p-6 border-t border-surface-100 bg-surface-50">
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3.5 px-6 bg-white border border-surface-200 text-surface-700 font-medium rounded-xl hover:bg-surface-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-500 hover:to-primary-600 transition-all shadow-lg shadow-primary-600/25"
                  >
                    <IconDownload size={20} />
                    <span>
                      {activeTab === "video" ? "Baixar Vídeo" : "Baixar Áudio"}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
