import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  IconPlayerPlay,
  IconPlayerPause,
  IconCut,
  IconAlertCircle,
  IconLoader2,
  IconChevronLeft,
  IconChevronRight,
  IconReload,
} from "@tabler/icons-react";

interface VideoTrimmerProps {
  videoUrl: string;
  duration: number;
  onTrimChange: (startTime: string, endTime: string) => void;
  onTrimToggle: (enabled: boolean) => void;
  trimEnabled: boolean;
  onStreamError?: () => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseTimeToSeconds(time: string): number {
  const parts = time.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export default function VideoTrimmer({
  videoUrl,
  duration,
  onTrimChange,
  onTrimToggle,
  trimEnabled,
  onStreamError,
}: VideoTrimmerProps) {
  const { t } = useTranslation("common");
  const videoRef = useRef<HTMLVideoElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(duration);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const [videoDuration, setVideoDuration] = useState(duration);

  // Manual time input state
  const [manualStart, setManualStart] = useState("0:00");
  const [manualEnd, setManualEnd] = useState(formatTime(duration));

  // Sync trim values to parent with a delay to avoid parent re-renders during smooth drag
  useEffect(() => {
    if (trimEnabled) {
      const handler = setTimeout(() => {
        onTrimChange(formatTime(startTime), formatTime(endTime));
      }, 300);
      return () => clearTimeout(handler);
    }
  }, [startTime, endTime, trimEnabled, onTrimChange]);

  // Update end time when duration changes
  useEffect(() => {
    if (duration > 0) {
      setEndTime(duration);
      setVideoDuration(duration);
      setManualEnd(formatTime(duration));
    }
  }, [duration]);

  // Track if this is the first load vs a src upgrade (proxy → blob)
  const hasLoadedOnceRef = useRef(false);
  const savedTimeRef = useRef(0);

  const handleVideoLoaded = () => {
    setIsLoading(false);
    const video = videoRef.current;
    if (!video) return;

    const dur = video.duration;
    if (dur && isFinite(dur)) {
      setVideoDuration(dur);
      // Only set endTime on first load — don't reset user's trim selection on blob swap
      if (!hasLoadedOnceRef.current) {
        setEndTime(dur);
        setManualEnd(formatTime(dur));
        hasLoadedOnceRef.current = true;
      }
    }

    // Restore position after src swap (proxy → blob)
    if (savedTimeRef.current > 0) {
      video.currentTime = savedTimeRef.current;
      setCurrentTime(savedTimeRef.current);
      savedTimeRef.current = 0;
    }
  };

  const handleVideoError = () => {
    setIsLoading(false);
    setHasError(true);
    onStreamError?.();
  };

  // When videoUrl changes: save current position, reset error state
  useEffect(() => {
    if (videoUrl) {
      // Save position so it can be restored after src swap
      if (videoRef.current && hasLoadedOnceRef.current) {
        savedTimeRef.current = videoRef.current.currentTime;
      }
      setHasError(false);
      setIsLoading(true);
    }
  }, [videoUrl]);

  const handleTimeUpdate = () => {
    if (!videoRef.current || dragging) return;
    const ct = videoRef.current.currentTime;

    // Clamp at start time
    if (trimEnabled && ct < startTime) {
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
      return;
    }

    setCurrentTime(ct);

    // Auto-pause at end time during preview
    if (trimEnabled && ct >= endTime) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // If at end, restart from start time
      if (trimEnabled && videoRef.current.currentTime >= endTime) {
        videoRef.current.currentTime = startTime;
      }
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekTo = useCallback(
    (time: number) => {
      if (!videoRef.current) return;
      const clamped = Math.max(0, Math.min(time, videoDuration));
      const video = videoRef.current;
      // fastSeek is less precise but instant — ideal for scrubbing/preview
      if (typeof (video as HTMLVideoElement & { fastSeek?: (t: number) => void }).fastSeek === "function") {
        (video as HTMLVideoElement & { fastSeek: (t: number) => void }).fastSeek(clamped);
      } else {
        video.currentTime = clamped;
      }
      setCurrentTime(clamped);
    },
    [videoDuration],
  );

  const adjustTime = (target: "start" | "end", delta: number) => {
    if (target === "start") {
      const newStart = Math.max(0, Math.min(startTime + delta, endTime - 1));
      setStartTime(newStart);
      setManualStart(formatTime(newStart));
      seekTo(newStart);
    } else {
      const newEnd = Math.max(
        startTime + 1,
        Math.min(endTime + delta, videoDuration),
      );
      setEndTime(newEnd);
      setManualEnd(formatTime(newEnd));
    }
  };

  const previewTrim = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = startTime;
    videoRef.current.play();
    setIsPlaying(true);
  };

  // Slider drag logic
  const getPositionFromEvent = useCallback(
    (clientX: number): number => {
      if (!sliderRef.current) return 0;
      const rect = sliderRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      return ratio * videoDuration;
    },
    [videoDuration],
  );

  const handleSliderMouseDown = (
    e: React.MouseEvent,
    handle: "start" | "end",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    // Pause during drag to avoid playback interfering with seeks
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    setDragging(handle);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const time = getPositionFromEvent(e.clientX);
      if (dragging === "start") {
        const newStart = Math.max(0, Math.min(time, endTime - 1));
        setStartTime(newStart);
        setManualStart(formatTime(newStart));
        seekTo(newStart);
      } else {
        const newEnd = Math.max(startTime + 1, Math.min(time, videoDuration));
        setEndTime(newEnd);
        setManualEnd(formatTime(newEnd));
        seekTo(newEnd);
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    dragging,
    startTime,
    endTime,
    videoDuration,
    getPositionFromEvent,
    seekTo,
  ]);

  const handleManualStartChange = (value: string) => {
    setManualStart(value);
    const seconds = parseTimeToSeconds(value);
    if (!isNaN(seconds) && seconds >= 0 && seconds < endTime) {
      setStartTime(seconds);
      seekTo(seconds);
    }
  };

  const handleManualEndChange = (value: string) => {
    setManualEnd(value);
    const seconds = parseTimeToSeconds(value);
    if (!isNaN(seconds) && seconds > startTime && seconds <= videoDuration) {
      setEndTime(seconds);
    }
  };

  const trimDuration = endTime - startTime;
  const startPercent =
    videoDuration > 0 ? (startTime / videoDuration) * 100 : 0;
  const endPercent = videoDuration > 0 ? (endTime / videoDuration) * 100 : 100;
  const currentPercent =
    videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface-100 dark:bg-surface-800">
            <IconCut
              size={20}
              className="text-surface-600 dark:text-surface-400"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
              {t("trimmer.title")}
            </label>
            <p className="text-xs text-surface-500 dark:text-surface-500">
              {t("trimmer.description")}
            </p>
          </div>
        </div>
        <button
          onClick={() => onTrimToggle(!trimEnabled)}
          className={`relative w-12 h-7 rounded-full transition-colors ${
            trimEnabled
              ? "bg-primary-500"
              : "bg-surface-300 dark:bg-surface-600"
          }`}
        >
          <motion.div
            animate={{ x: trimEnabled ? 22 : 2 }}
            className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
          />
        </button>
      </div>

      {/* Trimmer Content */}
      <AnimatePresence>
        {trimEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            {/* Video Player */}
            {videoUrl && !hasError ? (
              <div className="relative rounded-xl overflow-hidden bg-black">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <IconLoader2
                      size={32}
                      className="animate-spin text-white"
                    />
                  </div>
                )}
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full max-h-64 object-contain"
                  onLoadedMetadata={handleVideoLoaded}
                  onError={handleVideoError}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  preload="auto"
                />

                {/* Play/Pause Overlay */}
                {!isLoading && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors group"
                  >
                    <div className="p-3 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {isPlaying ? (
                        <IconPlayerPause size={24} />
                      ) : (
                        <IconPlayerPlay size={24} />
                      )}
                    </div>
                  </button>
                )}

                {/* Current Time Badge */}
                {!isLoading && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded font-mono">
                    {formatTime(currentTime)}
                  </div>
                )}
              </div>
            ) : hasError ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <IconAlertCircle size={18} />
                  <span className="text-sm font-medium">
                    {t("trimmer.preview_unavailable")}
                  </span>
                </div>
                <p className="text-xs text-amber-500 dark:text-amber-500">
                  {t("trimmer.manual_fallback")}
                </p>
              </div>
            ) : null}

            {/* Timeline Slider */}
            <div className="space-y-2">
              <div
                ref={sliderRef}
                className="relative h-10 bg-surface-100 dark:bg-surface-800 rounded-lg cursor-pointer select-none"
                onClick={(e) => {
                  const time = getPositionFromEvent(e.clientX);
                  seekTo(time);
                }}
              >
                {/* Selected Range */}
                <div
                  className="absolute top-0 h-full bg-primary-100 dark:bg-primary-900/30 rounded-lg"
                  style={{
                    left: `${startPercent}%`,
                    width: `${endPercent - startPercent}%`,
                  }}
                />

                {/* Current Time Indicator */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-primary-500 z-10 pointer-events-none"
                  style={{ left: `${currentPercent}%` }}
                />

                {/* Start Handle */}
                <div
                  className="absolute top-0 h-full w-4 cursor-ew-resize z-20 group"
                  style={{ left: `calc(${startPercent}% - 8px)` }}
                  onMouseDown={(e) => handleSliderMouseDown(e, "start")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`absolute top-1 bottom-1 left-1/2 -translate-x-1/2 w-1.5 rounded-full transition-colors ${
                      dragging === "start"
                        ? "bg-primary-600 w-2"
                        : "bg-primary-500 group-hover:bg-primary-600"
                    }`}
                  />
                </div>

                {/* End Handle */}
                <div
                  className="absolute top-0 h-full w-4 cursor-ew-resize z-20 group"
                  style={{ left: `calc(${endPercent}% - 8px)` }}
                  onMouseDown={(e) => handleSliderMouseDown(e, "end")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className={`absolute top-1 bottom-1 left-1/2 -translate-x-1/2 w-1.5 rounded-full transition-colors ${
                      dragging === "end"
                        ? "bg-primary-600 w-2"
                        : "bg-primary-500 group-hover:bg-primary-600"
                    }`}
                  />
                </div>
              </div>

              {/* Time Labels */}
              <div className="flex justify-between text-xs text-surface-400 font-mono">
                <span>0:00</span>
                <span>{formatTime(videoDuration)}</span>
              </div>
            </div>

            {/* Time Controls */}
            <div className="grid grid-cols-2 gap-4">
              {/* Start Time */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                  {t("trimmer.start")}
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => adjustTime("start", -5)}
                    className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                    title="-5s"
                  >
                    <IconChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => adjustTime("start", -1)}
                    className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors text-xs font-mono"
                    title="-1s"
                  >
                    -1
                  </button>
                  <input
                    type="text"
                    value={manualStart}
                    onChange={(e) => handleManualStartChange(e.target.value)}
                    className="flex-1 text-center py-1.5 px-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg text-sm font-mono focus:outline-none focus:border-primary-500"
                  />
                  <button
                    onClick={() => adjustTime("start", 1)}
                    className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors text-xs font-mono"
                    title="+1s"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => adjustTime("start", 5)}
                    className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                    title="+5s"
                  >
                    <IconChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* End Time */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wide">
                  {t("trimmer.end")}
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => adjustTime("end", -5)}
                    className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                    title="-5s"
                  >
                    <IconChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => adjustTime("end", -1)}
                    className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors text-xs font-mono"
                    title="-1s"
                  >
                    -1
                  </button>
                  <input
                    type="text"
                    value={manualEnd}
                    onChange={(e) => handleManualEndChange(e.target.value)}
                    className="flex-1 text-center py-1.5 px-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg text-sm font-mono focus:outline-none focus:border-primary-500"
                  />
                  <button
                    onClick={() => adjustTime("end", 1)}
                    className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors text-xs font-mono"
                    title="+1s"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => adjustTime("end", 5)}
                    className="p-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                    title="+5s"
                  >
                    <IconChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Duration Info + Preview Button */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-surface-500 dark:text-surface-400">
                <span className="font-medium text-surface-700 dark:text-surface-300">
                  {t("trimmer.selected_duration")}:
                </span>{" "}
                <span className="font-mono">{formatTime(trimDuration)}</span>
              </div>
              {videoUrl && !hasError && (
                <button
                  onClick={previewTrim}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                >
                  <IconReload size={14} />
                  {t("trimmer.preview")}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
