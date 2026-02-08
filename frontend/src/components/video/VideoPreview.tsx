import { motion, AnimatePresence } from "framer-motion";
import {
  IconVideo,
  IconMusic,
  IconDeviceTv,
  IconDeviceMobile,
  IconPhoto,
  IconFileMusic,
  IconBrandApple,
  IconVinyl,
  IconDownload,
  IconLoader2,
} from "@tabler/icons-react";
import { VideoInfo, Format } from "../../../bindings/kingo/internal/youtube/models.js";

// Re-export types from Wails v3 generated models
export type { VideoInfo, Format };

interface QualityOption {
  value: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  minHeight?: number;
  recommended?: boolean;
}

interface AudioFormat {
  value: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface VideoPreviewProps {
  videoInfo: VideoInfo;
  downloadMode: "video" | "audio";
  setDownloadMode: (mode: "video" | "audio") => void;
  selectedQuality: string;
  setSelectedQuality: (quality: string) => void;
  selectedAudioFormat: string;
  setSelectedAudioFormat: (format: string) => void;
  videoQualities: QualityOption[];
  audioFormats: AudioFormat[];
  isLoading: boolean;
  onDownload: () => void;
  formatDuration: (seconds: number) => string;
  formatViews: (count: number) => string;
}

export default function VideoPreview({
  videoInfo,
  downloadMode,
  setDownloadMode,
  selectedQuality,
  setSelectedQuality,
  selectedAudioFormat,
  setSelectedAudioFormat,
  videoQualities,
  audioFormats,
  isLoading,
  onDownload,
  formatDuration,
  formatViews,
}: VideoPreviewProps) {
  // Find max available height from formats
  const maxH = Math.max(
    ...(videoInfo.formats?.map((f) => f.height || 0) || [0])
  );

  return (
    <motion.div
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
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <IconVideo size={32} className="text-surface-400" />
            </div>
          )}
          {videoInfo.duration > 0 && (
            <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded-md">
              {formatDuration(videoInfo.duration)}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-surface-900 line-clamp-2 mb-1">
            {videoInfo.title}
          </h3>
          <p className="text-sm text-surface-500 mb-2">{videoInfo.uploader}</p>
          <div className="flex gap-3 text-xs text-surface-400">
            {videoInfo.view_count > 0 && (
              <span>{formatViews(videoInfo.view_count)} visualizações</span>
            )}
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setDownloadMode("video")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
            downloadMode === "video"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-600/25"
              : "bg-surface-100 dark:bg-surface-200/50 text-surface-600 hover:text-surface-900"
          }`}
        >
          <IconVideo size={18} />
          <span>Vídeo</span>
        </button>
        <button
          onClick={() => setDownloadMode("audio")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
            downloadMode === "audio"
              ? "bg-primary-600 text-white shadow-lg shadow-primary-600/25"
              : "bg-surface-100 dark:bg-surface-200/50 text-surface-600 hover:text-surface-900"
          }`}
        >
          <IconMusic size={18} />
          <span>Áudio</span>
        </button>
      </div>

      {/* Quality/Format Selection */}
      <AnimatePresence mode="wait">
        {downloadMode === "video" ? (
          <motion.div
            key="video-options"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <p className="text-sm font-medium text-surface-600 mb-3">
              Qualidade do Vídeo
            </p>
            <div className="grid grid-cols-4 gap-2">
              {videoQualities.map((quality) => {
                const isAvailable = maxH >= (quality.minHeight || 0);
                const Icon = quality.icon;

                return (
                  <button
                    key={quality.value}
                    onClick={() =>
                      isAvailable && setSelectedQuality(quality.value)
                    }
                    disabled={!isAvailable}
                    className={`relative flex flex-col items-center px-3 py-4 rounded-xl border-2 transition-all ${
                      selectedQuality === quality.value
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10"
                        : isAvailable
                        ? "border-surface-200 dark:border-surface-200 hover:border-surface-300"
                        : "border-surface-100 dark:border-surface-200/50 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {quality.recommended && (
                      <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-primary-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                        REC
                      </span>
                    )}
                    <Icon
                      size={20}
                      className={
                        selectedQuality === quality.value
                          ? "text-primary-600"
                          : "text-surface-400"
                      }
                    />
                    <span
                      className={`font-medium mt-1 ${
                        selectedQuality === quality.value
                          ? "text-primary-600"
                          : "text-surface-700"
                      }`}
                    >
                      {quality.label}
                    </span>
                    <span className="text-xs text-surface-400">
                      {quality.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="audio-options"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <p className="text-sm font-medium text-surface-600 mb-3">
              Formato do Áudio
            </p>
            <div className="grid grid-cols-3 gap-2">
              {audioFormats.map((format) => {
                const Icon = format.icon;
                return (
                  <button
                    key={format.value}
                    onClick={() => setSelectedAudioFormat(format.value)}
                    className={`flex flex-col items-center px-3 py-4 rounded-xl border-2 transition-all ${
                      selectedAudioFormat === format.value
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10"
                        : "border-surface-200 dark:border-surface-200 hover:border-surface-300"
                    }`}
                  >
                    <Icon
                      size={20}
                      className={
                        selectedAudioFormat === format.value
                          ? "text-primary-600"
                          : "text-surface-400"
                      }
                    />
                    <span
                      className={`font-medium mt-1 ${
                        selectedAudioFormat === format.value
                          ? "text-primary-600"
                          : "text-surface-700"
                      }`}
                    >
                      {format.label}
                    </span>
                    <span className="text-xs text-surface-400">
                      {format.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Download Button */}
      <button
        onClick={onDownload}
        disabled={isLoading}
        className="w-full btn btn-primary py-4 text-base font-semibold"
      >
        {isLoading ? (
          <>
            <IconLoader2 size={20} className="animate-spin mr-2" />
            Adicionando à fila...
          </>
        ) : (
          <>
            <IconDownload size={20} className="mr-2" />
            Baixar {downloadMode === "video" ? "Vídeo" : "Áudio"}
          </>
        )}
      </button>
    </motion.div>
  );
}

// Export quality presets generator
export const getVideoQualities = (
  compatibility: "universal" | "modern"
): QualityOption[] => {
  const codecFilter =
    compatibility === "universal"
      ? "[vcodec^=avc1]" // H.264 apenas
      : ""; // Qualquer codec

  const audioFilter =
    compatibility === "universal"
      ? "[acodec^=mp4a]" // AAC apenas
      : ""; // Qualquer codec (permite Opus)

  return [
    {
      value: `bestvideo[height<=2160]${codecFilter}+bestaudio${audioFilter}/best[height<=2160]`,
      label: "4K",
      desc: "2160p",
      icon: IconDeviceTv,
      minHeight: 1440,
    },
    {
      value: `bestvideo[height<=1080]${codecFilter}+bestaudio${audioFilter}/best[height<=1080]`,
      label: "Full HD",
      desc: "1080p",
      icon: IconDeviceTv,
      recommended: true,
      minHeight: 1080,
    },
    {
      value: `bestvideo[height<=720]${codecFilter}+bestaudio${audioFilter}/best[height<=720]`,
      label: "HD",
      desc: "720p",
      icon: IconDeviceMobile,
      minHeight: 720,
    },
    {
      value: `bestvideo[height<=480]${codecFilter}+bestaudio${audioFilter}/best[height<=480]`,
      label: "SD",
      desc: "480p",
      icon: IconPhoto,
      minHeight: 0,
    },
  ];
};

export const AUDIO_FORMATS: AudioFormat[] = [
  { value: "mp3", label: "MP3", desc: "Compatível", icon: IconFileMusic },
  { value: "m4a", label: "M4A", desc: "Qualidade", icon: IconBrandApple },
  { value: "flac", label: "FLAC", desc: "Lossless", icon: IconVinyl },
];
