import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  GetVideoSubtitles,
  ListWhisperModels,
} from "../../../bindings/kingo/app";
import CaptionInspector from "./CaptionInspector";
import type {
  CaptionOptions,
  CaptionSource,
  SubtitleCue,
  SubtitleLanguage,
  WhisperModel,
} from "./captions";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconCheck,
  IconClock,
  IconChevronLeft,
  IconChevronRight,
  IconCut,
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconPlayerTrackNext,
  IconPlayerTrackPrev,
  IconReload,
  IconRestore,
  IconSubtitles,
  IconTrash,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";

export interface CutRange {
  start: number;
  end: number;
}

interface EditSnapshot {
  cutRanges: CutRange[];
  splitPoints: number[];
}

interface VideoTrimmerProps {
  videoUrl: string;
  sourceUrl?: string;
  duration: number;
  onCutsChange: (ranges: CutRange[]) => void;
  onTrimToggle: (enabled: boolean) => void;
  trimEnabled: boolean;
  onStreamError?: () => void;
  captions: CaptionOptions;
  onCaptionsChange: (options: CaptionOptions) => void;
  subtitleLanguages?: SubtitleLanguage[];
  videoLanguage?: string;
}

const MIN_CLIP_DURATION = 0.25;

function TimelineToolButton({
  disabled = false,
  icon,
  label,
  onClick,
  shortcut,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  shortcut: string;
}) {
  return (
    <span className="group relative flex h-8 w-8 shrink-0 items-center justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="flex h-8 w-8 items-center justify-center rounded text-surface-500 outline-none transition-colors hover:bg-surface-200 hover:text-surface-900 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:hover:bg-surface-300 dark:hover:text-surface-900 dark:focus-visible:ring-offset-surface-100 disabled:opacity-30"
      >
        <span aria-hidden="true">{icon}</span>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-[70] mt-2 flex -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md border border-surface-300 bg-surface-900 px-2.5 py-2 text-[10px] font-medium text-surface-50 opacity-0 shadow-xl transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 dark:border-surface-400 dark:bg-surface-200 dark:text-surface-900"
      >
        {label}
        <kbd className="ml-2 rounded border border-white/20 bg-white/10 px-1 py-0.5 font-mono text-[9px] text-white/75">
          {shortcut}
        </kbd>
      </span>
    </span>
  );
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = Math.floor(safeSeconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseTimeToSeconds(time: string): number | null {
  const parts = time.trim().split(":");
  if (parts.length === 0 || parts.length > 3) return null;
  const values = parts.map(Number);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return null;
  if (values.length === 3) return values[0] * 3600 + values[1] * 60 + values[2];
  if (values.length === 2) return values[0] * 60 + values[1];
  return values[0];
}

function sameRange(left: CutRange | null, right: CutRange): boolean {
  return (
    !!left &&
    Math.abs(left.start - right.start) < 0.02 &&
    Math.abs(left.end - right.end) < 0.02
  );
}

function hexToRGBA(hex: string, opacity: number): string {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "000000";
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
}

function captionTextShadow(color: string, width: number): string {
  const distance = Math.max(0, width * 0.55);
  if (distance === 0) return "none";
  return [
    [-distance, -distance],
    [0, -distance],
    [distance, -distance],
    [-distance, 0],
    [distance, 0],
    [-distance, distance],
    [0, distance],
    [distance, distance],
  ]
    .map(([x, y]) => `${x}px ${y}px 1px ${color}`)
    .join(", ");
}

function VideoTrimmerInner({
  videoUrl,
  sourceUrl = "",
  duration,
  onCutsChange,
  onTrimToggle,
  trimEnabled,
  onStreamError,
  captions,
  onCaptionsChange,
  subtitleLanguages = [],
  videoLanguage = "",
}: VideoTrimmerProps) {
  const { t, i18n } = useTranslation("common");
  const videoRef = useRef<HTMLVideoElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const hasLoadedOnceRef = useRef(false);
  const savedTimeRef = useRef(0);
  const captionRequestRef = useRef(0);
  const captionsRef = useRef(captions);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration);
  const [cursorInput, setCursorInput] = useState("0:00");
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [cutRanges, setCutRanges] = useState<CutRange[]>([]);
  const [selectedClip, setSelectedClip] = useState<CutRange | null>(null);
  const [history, setHistory] = useState<EditSnapshot[]>([]);
  const [future, setFuture] = useState<EditSnapshot[]>([]);
  const [isCaptionPanelOpen, setIsCaptionPanelOpen] = useState(false);
  const [isLoadingCaptions, setIsLoadingCaptions] = useState(false);
  const [captionError, setCaptionError] = useState("");
  const [whisperModels, setWhisperModels] = useState<WhisperModel[]>([]);

  useEffect(() => {
    captionsRef.current = captions;
  }, [captions]);

  const applyCaptionsChange = useCallback(
    (options: CaptionOptions) => {
      captionsRef.current = options;
      onCaptionsChange(options);
    },
    [onCaptionsChange],
  );

  useEffect(() => {
    if (!isEditorOpen) return;
    const frame = requestAnimationFrame(() => editorRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isEditorOpen]);

  useEffect(() => {
    if (duration <= 0) return;
    setVideoDuration(duration);
    setCurrentTime(0);
    setCursorInput("0:00");
    setTimelineZoom(1);
    setSplitPoints([]);
    setCutRanges([]);
    setSelectedClip(null);
    setHistory([]);
    setFuture([]);
    setIsCaptionPanelOpen(false);
    setCaptionError("");
    hasLoadedOnceRef.current = false;
  }, [duration]);

  useEffect(() => {
    onCutsChange(trimEnabled ? cutRanges : []);
  }, [cutRanges, trimEnabled, onCutsChange]);

  useEffect(() => {
    if (!videoUrl) return;
    if (videoRef.current && hasLoadedOnceRef.current) {
      savedTimeRef.current = videoRef.current.currentTime;
    }
    setHasError(false);
    setIsLoading(true);
  }, [videoUrl]);

  useEffect(() => {
    captionRequestRef.current += 1;
    setIsLoadingCaptions(false);
    setCaptionError("");
  }, [sourceUrl]);

  const allClips = useMemo(() => {
    const boundaries = [0, ...splitPoints, videoDuration]
      .filter((point) => point >= 0 && point <= videoDuration)
      .sort((a, b) => a - b)
      .filter((point, index, points) => index === 0 || point - points[index - 1] >= 0.02);

    return boundaries.slice(0, -1).map((start, index) => ({
      start,
      end: boundaries[index + 1],
    }));
  }, [splitPoints, videoDuration]);

  const visibleClips = useMemo(
    () =>
      allClips.filter(
        (clip) =>
          !cutRanges.some(
            (cut) => clip.start >= cut.start - 0.02 && clip.end <= cut.end + 0.02,
          ),
      ),
    [allClips, cutRanges],
  );

  const outputDuration = useMemo(
    () => visibleClips.reduce((total, clip) => total + clip.end - clip.start, 0),
    [visibleClips],
  );

  const activeClip = useMemo(
    () =>
      visibleClips.find(
        (clip) => currentTime >= clip.start - 0.02 && currentTime < clip.end - 0.02,
      ) ?? null,
    [visibleClips, currentTime],
  );

  const currentEditedTime = useMemo(() => {
    let elapsed = 0;
    for (const clip of visibleClips) {
      if (currentTime >= clip.end) {
        elapsed += clip.end - clip.start;
        continue;
      }
      if (currentTime >= clip.start) return elapsed + currentTime - clip.start;
      return elapsed;
    }
    return outputDuration;
  }, [currentTime, outputDuration, visibleClips]);

  const playheadPercent =
    outputDuration > 0 ? (currentEditedTime / outputDuration) * 100 : 0;

  useEffect(() => {
    const viewport = timelineViewportRef.current;
    const timeline = timelineRef.current;
    if (!viewport || !timeline || timelineZoom <= 1) return;
    const playheadX = timeline.clientWidth * (playheadPercent / 100);
    const leftEdge = viewport.scrollLeft + 24;
    const rightEdge = viewport.scrollLeft + viewport.clientWidth - 24;
    if (playheadX < leftEdge || playheadX > rightEdge) {
      viewport.scrollLeft = Math.max(0, playheadX - viewport.clientWidth / 2);
    }
  }, [playheadPercent, timelineZoom]);

  const recordSnapshot = () => {
    setHistory((items) => [
      ...items,
      {
        cutRanges: cutRanges.map((range) => ({ ...range })),
        splitPoints: [...splitPoints],
      },
    ]);
    setFuture([]);
  };

  const seekTo = useCallback(
    (sourceTime: number) => {
      const clamped = Math.max(0, Math.min(sourceTime, videoDuration));
      const video = videoRef.current;
      if (video) {
        if (
          typeof (video as HTMLVideoElement & { fastSeek?: (time: number) => void })
            .fastSeek === "function"
        ) {
          (video as HTMLVideoElement & { fastSeek: (time: number) => void }).fastSeek(
            clamped,
          );
        } else {
          video.currentTime = clamped;
        }
      }
      setCurrentTime(clamped);
      setCursorInput(formatTime(clamped));
    },
    [videoDuration],
  );

  const preferredCaptionLanguage = useMemo(() => {
    const interfaceLanguage = i18n.language || "";
    const candidates = [
      videoLanguage,
      videoLanguage.split("-")[0],
      interfaceLanguage,
      interfaceLanguage.split("-")[0],
      "pt-BR",
      "pt",
      "en",
    ].filter(Boolean);
    for (const candidate of candidates) {
      const exact = subtitleLanguages.find(
        (language) => language.code.toLowerCase() === candidate.toLowerCase(),
      );
      if (exact) return exact.code;
    }
    return subtitleLanguages[0]?.code || "auto";
  }, [i18n.language, subtitleLanguages, videoLanguage]);

  const loadWhisperModels = useCallback(async () => {
    try {
      const result = await ListWhisperModels();
      const models = Array.isArray(result)
        ? (result as unknown as WhisperModel[])
        : [];
      setWhisperModels(models);
      return models;
    } catch {
      setWhisperModels([]);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!isCaptionPanelOpen) return;
    void loadWhisperModels();
  }, [isCaptionPanelOpen, loadWhisperModels]);

  const loadRemoteCaptions = useCallback(
    async (language: string, baseOptions: CaptionOptions) => {
      if (!sourceUrl) {
        setCaptionError(t("trimmer.caption_source_unavailable"));
        return;
      }
      const requestID = ++captionRequestRef.current;
      setIsLoadingCaptions(true);
      setCaptionError("");
      try {
        const result = await GetVideoSubtitles(sourceUrl, language);
        if (requestID !== captionRequestRef.current) return;
        const cues = Array.isArray(result?.cues)
          ? (result.cues as unknown as SubtitleCue[])
          : [];
        const nextOptions: CaptionOptions = {
          ...captionsRef.current,
          language: result?.language || language,
          cues,
        };
        applyCaptionsChange(nextOptions);
        if (cues.length === 0) {
          setCaptionError(
            baseOptions.source === "youtube"
              ? t("trimmer.caption_youtube_missing")
              : t("trimmer.caption_whisper_fallback"),
          );
        }
      } catch {
        if (requestID !== captionRequestRef.current) return;
        applyCaptionsChange({ ...captionsRef.current, language, cues: [] });
        setCaptionError(
          baseOptions.source === "youtube"
            ? t("trimmer.caption_youtube_missing")
            : t("trimmer.caption_whisper_fallback"),
        );
      } finally {
        if (requestID === captionRequestRef.current) {
          setIsLoadingCaptions(false);
        }
      }
    },
    [applyCaptionsChange, sourceUrl, t],
  );

  const openCaptionEditor = useCallback(() => {
    if (!trimEnabled) onTrimToggle(true);
    setIsCaptionPanelOpen(true);
    const language =
      captions.language === "auto" ? preferredCaptionLanguage : captions.language;
    const nextOptions: CaptionOptions = {
      ...captions,
      enabled: true,
      language,
    };
    applyCaptionsChange(nextOptions);
    void loadWhisperModels();
    if (nextOptions.source !== "whisper" && nextOptions.cues.length === 0) {
      void loadRemoteCaptions(language, nextOptions);
    }
  }, [
    captions,
    loadRemoteCaptions,
    loadWhisperModels,
    applyCaptionsChange,
    onTrimToggle,
    preferredCaptionLanguage,
    trimEnabled,
  ]);

  const handleCaptionSourceChange = useCallback(
    (source: CaptionSource) => {
      const language =
        captions.language === "auto" ? preferredCaptionLanguage : captions.language;
      const nextOptions: CaptionOptions = {
        ...captions,
        enabled: true,
        source,
        language,
        cues: [],
      };
      applyCaptionsChange(nextOptions);
      setCaptionError("");
      if (source === "whisper") {
        captionRequestRef.current += 1;
        setIsLoadingCaptions(false);
      } else {
        void loadRemoteCaptions(language, nextOptions);
      }
    },
    [
      captions,
      loadRemoteCaptions,
      applyCaptionsChange,
      preferredCaptionLanguage,
    ],
  );

  const handleCaptionLanguageChange = useCallback(
    (language: string) => {
      const resolvedLanguage =
        language === "auto" ? preferredCaptionLanguage : language;
      const nextOptions: CaptionOptions = {
        ...captions,
        enabled: true,
        language: resolvedLanguage,
        cues: [],
      };
      applyCaptionsChange(nextOptions);
      setCaptionError("");
      if (nextOptions.source !== "whisper") {
        void loadRemoteCaptions(resolvedLanguage, nextOptions);
      }
    },
    [
      captions,
      loadRemoteCaptions,
      applyCaptionsChange,
      preferredCaptionLanguage,
    ],
  );

  const reloadCaptions = useCallback(() => {
    const language =
      captions.language === "auto" ? preferredCaptionLanguage : captions.language;
    void loadRemoteCaptions(language, { ...captions, language, cues: [] });
  }, [captions, loadRemoteCaptions, preferredCaptionLanguage]);

  const seekFromTimeline = useCallback(
    (clientX: number) => {
      const timeline = timelineRef.current;
      if (!timeline || outputDuration <= 0) return;
      const rect = timeline.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const target = ratio * outputDuration;
      let elapsed = 0;
      for (const clip of visibleClips) {
        const clipDuration = clip.end - clip.start;
        if (target <= elapsed + clipDuration) {
          seekTo(clip.start + target - elapsed);
          return;
        }
        elapsed += clipDuration;
      }
      seekTo(visibleClips[visibleClips.length - 1]?.end ?? 0);
    },
    [outputDuration, seekTo, visibleClips],
  );

  useEffect(() => {
    if (!isScrubbing) return;
    const handleMove = (event: PointerEvent) => seekFromTimeline(event.clientX);
    const handleUp = () => setIsScrubbing(false);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isScrubbing, seekFromTimeline]);

  const handleVideoLoaded = () => {
    setIsLoading(false);
    const video = videoRef.current;
    if (!video) return;
    if (video.duration && Number.isFinite(video.duration)) {
      setVideoDuration(video.duration);
      hasLoadedOnceRef.current = true;
    }
    if (savedTimeRef.current > 0) {
      seekTo(savedTimeRef.current);
      savedTimeRef.current = 0;
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || isScrubbing) return;
    const sourceTime = video.currentTime;
    const removed = cutRanges.find(
      (range) => sourceTime >= range.start && sourceTime < range.end - 0.04,
    );
    if (trimEnabled && removed) {
      seekTo(removed.end);
      return;
    }
    setCurrentTime(sourceTime);
    setCursorInput(formatTime(sourceTime));
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    if (video.currentTime >= videoDuration - 0.05) {
      seekTo(visibleClips[0]?.start ?? 0);
    }
    void video.play();
  }, [seekTo, videoDuration, visibleClips]);

  const pausePlayback = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const playForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime >= videoDuration - 0.05) {
      seekTo(visibleClips[0]?.start ?? 0);
    }
    void video.play();
  }, [seekTo, videoDuration, visibleClips]);

  const stepFrame = useCallback(
    (direction: -1 | 1) => {
      pausePlayback();
      seekTo(currentTime + direction / 30);
    },
    [currentTime, pausePlayback, seekTo],
  );

  const jumpToEdit = useCallback(
    (direction: -1 | 1) => {
      const boundaries = Array.from(
        new Set(visibleClips.flatMap((clip) => [clip.start, clip.end])),
      ).sort((a, b) => a - b);
      const target =
        direction < 0
          ? [...boundaries].reverse().find((point) => point < currentTime - 0.05)
          : boundaries.find((point) => point > currentTime + 0.05);
      if (target !== undefined) seekTo(target);
    },
    [currentTime, seekTo, visibleClips],
  );

  const splitAtPlayhead = useCallback(() => {
    const clip = visibleClips.find(
      (item) => currentTime > item.start + MIN_CLIP_DURATION && currentTime < item.end - MIN_CLIP_DURATION,
    );
    if (!clip) return;
    const point = Math.round(currentTime * 100) / 100;
    setHistory((items) => [
      ...items,
      {
        cutRanges: cutRanges.map((range) => ({ ...range })),
        splitPoints: [...splitPoints],
      },
    ]);
    setFuture([]);
    setSplitPoints((points) => [...points, point].sort((a, b) => a - b));
    setSelectedClip({ start: point, end: clip.end });
  }, [currentTime, cutRanges, splitPoints, visibleClips]);

  const deleteSelectedClip = useCallback(() => {
    if (!selectedClip || visibleClips.length <= 1) return;
    setHistory((items) => [
      ...items,
      {
        cutRanges: cutRanges.map((range) => ({ ...range })),
        splitPoints: [...splitPoints],
      },
    ]);
    setFuture([]);
    setCutRanges((ranges) => [...ranges, { ...selectedClip }]);
    setSelectedClip(null);
    const following = visibleClips.find((clip) => clip.start >= selectedClip.end - 0.02);
    const previous = [...visibleClips]
      .reverse()
      .find((clip) => clip.end <= selectedClip.start + 0.02);
    seekTo(following?.start ?? (previous ? Math.max(previous.start, previous.end - 0.05) : 0));
  }, [cutRanges, seekTo, selectedClip, splitPoints, visibleClips]);

  const undo = useCallback(() => {
    const snapshot = history[history.length - 1];
    if (!snapshot) return;
    setFuture((items) => [
      ...items,
      {
        cutRanges: cutRanges.map((range) => ({ ...range })),
        splitPoints: [...splitPoints],
      },
    ]);
    setCutRanges(snapshot.cutRanges);
    setSplitPoints(snapshot.splitPoints);
    setSelectedClip(null);
    setHistory((items) => items.slice(0, -1));
  }, [cutRanges, history, splitPoints]);

  const redo = useCallback(() => {
    const snapshot = future[future.length - 1];
    if (!snapshot) return;
    setHistory((items) => [
      ...items,
      {
        cutRanges: cutRanges.map((range) => ({ ...range })),
        splitPoints: [...splitPoints],
      },
    ]);
    setCutRanges(snapshot.cutRanges);
    setSplitPoints(snapshot.splitPoints);
    setSelectedClip(null);
    setFuture((items) => items.slice(0, -1));
  }, [cutRanges, future, splitPoints]);

  const restoreRange = (index: number) => {
    const range = cutRanges[index];
    if (!range) return;
    recordSnapshot();
    setCutRanges((ranges) => ranges.filter((_, itemIndex) => itemIndex !== index));
    setSelectedClip(range);
    seekTo(range.start);
  };

  const previewEdit = () => {
    seekTo(visibleClips[0]?.start ?? 0);
    void videoRef.current?.play();
  };

  const commitCursorInput = () => {
    const parsed = parseTimeToSeconds(cursorInput);
    if (parsed !== null) seekTo(parsed);
    else setCursorInput(formatTime(currentTime));
  };

  const activeCaptionCue = useMemo(
    () =>
      captions.cues.find(
        (cue) => currentTime >= cue.start && currentTime < cue.end,
      ) || null,
    [captions.cues, currentTime],
  );

  const captionTrackItems = useMemo(() => {
    if (!captions.enabled || captions.cues.length === 0 || outputDuration <= 0) {
      return [];
    }
    const items: Array<{
      key: string;
      start: number;
      end: number;
      sourceStart: number;
      text: string;
    }> = [];
    let outputOffset = 0;
    visibleClips.forEach((clip, clipIndex) => {
      captions.cues.forEach((cue, cueIndex) => {
        const intersectionStart = Math.max(cue.start, clip.start);
        const intersectionEnd = Math.min(cue.end, clip.end);
        if (intersectionEnd - intersectionStart < 0.05) return;
        items.push({
          key: `${clipIndex}-${cueIndex}-${intersectionStart}`,
          start: outputOffset + intersectionStart - clip.start,
          end: outputOffset + intersectionEnd - clip.start,
          sourceStart: intersectionStart,
          text: cue.text,
        });
      });
      outputOffset += clip.end - clip.start;
    });
    if (items.length <= 1500) return items;
    const step = Math.ceil(items.length / 1500);
    return items.filter((_, index) => index % step === 0);
  }, [captions.cues, captions.enabled, outputDuration, visibleClips]);

  const previewCaptionText =
    activeCaptionCue?.text ||
    (captions.cues.length === 0 && isCaptionPanelOpen
      ? t("trimmer.caption_preview_sample")
      : "");

  const canSplit = !!activeClip && currentTime > activeClip.start + MIN_CLIP_DURATION && currentTime < activeClip.end - MIN_CLIP_DURATION;

  const handleKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const element = event.target as HTMLElement;
    if (
      element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.tagName === "SELECT"
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      setIsEditorOpen(false);
    } else if (
      (event.ctrlKey || event.metaKey) &&
      (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))
    ) {
      event.preventDefault();
      redo();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    } else if ((event.ctrlKey || event.metaKey) && event.key === "ArrowLeft") {
      event.preventDefault();
      jumpToEdit(-1);
    } else if ((event.ctrlKey || event.metaKey) && event.key === "ArrowRight") {
      event.preventDefault();
      jumpToEdit(1);
    } else if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      splitAtPlayhead();
    } else if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      previewEdit();
    } else if (event.key === "-") {
      event.preventDefault();
      setTimelineZoom((zoom) => Math.max(1, zoom - 1));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setTimelineZoom((zoom) => Math.min(4, zoom + 1));
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelectedClip();
    } else if (event.code === "Space" && element.tagName !== "BUTTON") {
      event.preventDefault();
      togglePlay();
    } else if (event.key.toLowerCase() === "j") {
      event.preventDefault();
      pausePlayback();
      seekTo(currentTime - 5);
    } else if (event.key.toLowerCase() === "k") {
      event.preventDefault();
      pausePlayback();
    } else if (event.key.toLowerCase() === "l") {
      event.preventDefault();
      playForward();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (event.shiftKey) seekTo(currentTime - 5);
      else stepFrame(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (event.shiftKey) seekTo(currentTime + 5);
      else stepFrame(1);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-surface-100 p-2 dark:bg-surface-200">
            <IconCut size={20} className="text-surface-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-800">{t("trimmer.title")}</p>
            <p className="text-xs text-surface-500">{t("trimmer.editor_description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsEditorOpen(true);
              openCaptionEditor();
            }}
            className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
              captions.enabled
                ? "border-primary-500 bg-primary-500/10 text-primary-700 dark:text-primary-300"
                : "border-surface-200 text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-200"
            }`}
          >
            <IconSubtitles size={16} />
            {captions.enabled
              ? t("trimmer.edit_captions")
              : t("trimmer.add_captions")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!trimEnabled) onTrimToggle(true);
              setIsEditorOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-700"
          >
            <IconCut size={16} />
            {cutRanges.length > 0 ? t("trimmer.continue_editing") : t("trimmer.open_editor")}
          </button>
        </div>
      </div>

      {createPortal(
        <AnimatePresence initial={false}>
        {isEditorOpen && (
          <motion.div
            ref={editorRef}
            tabIndex={0}
            onKeyDown={handleKeyboard}
            initial={{ opacity: 0, scale: 0.985, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.99, y: 12 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[10000] flex flex-col overflow-hidden bg-surface-50 text-surface-900 outline-none"
          >
            <header className="flex h-16 shrink-0 items-center justify-between gap-5 border-b border-surface-200 bg-surface-50 px-5 dark:border-surface-200">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="rounded-lg p-2 text-surface-600 transition-colors hover:bg-surface-200"
                  title={t("trimmer.close_editor")}
                >
                  <IconArrowLeft size={20} />
                </button>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-surface-900">
                    {t("trimmer.editor_title")}
                  </h2>
                  <p className="text-[11px] text-surface-500">
                    {t("trimmer.editor_subtitle")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (isCaptionPanelOpen) setIsCaptionPanelOpen(false);
                    else openCaptionEditor();
                  }}
                  aria-pressed={isCaptionPanelOpen}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    isCaptionPanelOpen
                      ? "border-primary-500 bg-primary-500/10 text-primary-700 dark:text-primary-300"
                      : "border-surface-200 text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-200"
                  }`}
                >
                  <IconSubtitles size={16} />
                  {t("trimmer.captions")}
                </button>
                <span className="hidden text-xs text-surface-500 sm:block">
                  {t("trimmer.output_duration")}: {" "}
                  <strong className="font-mono text-surface-800">{formatTime(outputDuration)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-700"
                >
                  <IconCheck size={16} />
                  {t("trimmer.finish_editing")}
                </button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1">
              <section className="relative min-h-0 flex-1 bg-black p-3">
            {videoUrl && !hasError ? (
              <div className="relative h-full overflow-hidden rounded-xl bg-black">
                {isLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55">
                    <IconLoader2 size={32} className="animate-spin text-white" />
                  </div>
                )}
                <video
                  ref={videoRef}
                  src={videoUrl}
                  preload="auto"
                  className="h-full w-full object-contain"
                  onLoadedMetadata={handleVideoLoaded}
                  onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                    onStreamError?.();
                  }}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
                {!isLoading && (
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/15 group"
                    aria-label={isPlaying ? t("trimmer.pause") : t("trimmer.play")}
                  >
                    <span
                      className={`rounded-full bg-black/60 p-4 text-white shadow-xl backdrop-blur transition-opacity ${
                        isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                      }`}
                    >
                      {isPlaying ? <IconPlayerPause size={26} /> : <IconPlayerPlay size={26} />}
                    </span>
                  </button>
                )}
                {captions.enabled && previewCaptionText && (
                  <div
                    className={`pointer-events-none absolute inset-x-[8%] z-30 flex justify-center text-center ${
                      captions.style.position === "top"
                        ? "top-[10%]"
                        : captions.style.position === "center"
                          ? "top-1/2 -translate-y-1/2"
                          : "bottom-[12%]"
                    }`}
                  >
                    <span
                      className="max-w-full whitespace-pre-line rounded px-3 py-1.5 leading-tight"
                      style={{
                        color: captions.style.textColor,
                        backgroundColor: hexToRGBA(
                          captions.style.backgroundColor,
                          captions.style.backgroundOpacity,
                        ),
                        fontFamily: captions.style.fontFamily,
                        fontSize: `${Math.max(14, captions.style.fontSize * 0.45)}px`,
                        fontWeight: captions.style.bold ? 800 : 400,
                        fontStyle: captions.style.italic ? "italic" : "normal",
                        textShadow: captionTextShadow(
                          captions.style.outlineColor,
                          captions.style.outlineWidth,
                        ),
                      }}
                    >
                      {previewCaptionText}
                    </span>
                  </div>
                )}
                <span className="absolute bottom-2 left-2 rounded bg-black/75 px-2 py-1 font-mono text-xs text-white">
                  {formatTime(currentTime)} / {formatTime(videoDuration)}
                </span>
              </div>
            ) : hasError ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-amber-800 bg-amber-950/30 p-4">
                <div>
                <div className="mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <IconAlertCircle size={18} />
                  <span className="text-sm font-medium">{t("trimmer.preview_unavailable")}</span>
                </div>
                <p className="text-xs text-amber-500">{t("trimmer.manual_fallback")}</p>
                </div>
              </div>
            ) : null}

            <div className="absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/75 px-3 py-2.5 text-white shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => jumpToEdit(-1)}
                  className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                  title={t("trimmer.previous_edit")}
                >
                  <IconPlayerTrackPrev size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => seekTo(currentTime - 5)}
                  className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                  title={t("trimmer.back_five")}
                >
                  <IconPlayerSkipBack size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => stepFrame(-1)}
                  className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                  title={t("trimmer.previous_frame")}
                >
                  <IconChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={togglePlay}
                  className="mx-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white shadow-md shadow-primary-600/20 transition-transform hover:scale-105 hover:bg-primary-700"
                  title={isPlaying ? t("trimmer.pause") : t("trimmer.play")}
                >
                  {isPlaying ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} />}
                </button>
                <button
                  type="button"
                  onClick={() => stepFrame(1)}
                  className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                  title={t("trimmer.next_frame")}
                >
                  <IconChevronRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => seekTo(currentTime + 5)}
                  className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                  title={t("trimmer.forward_five")}
                >
                  <IconPlayerSkipForward size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => jumpToEdit(1)}
                  className="rounded-lg p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                  title={t("trimmer.next_edit")}
                >
                  <IconPlayerTrackNext size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <IconClock size={15} className="text-zinc-400" />
                <input
                  value={cursorInput}
                  onChange={(event) => setCursorInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitCursorInput();
                  }}
                  onBlur={commitCursorInput}
                  aria-label={t("trimmer.playhead_time")}
                  className="w-24 rounded-lg border border-white/15 bg-white/10 px-2 py-2 text-center font-mono text-xs text-white outline-none focus:border-primary-500"
                />
                <button
                  type="button"
                  onClick={splitAtPlayhead}
                  disabled={!canSplit}
                  aria-label={t("trimmer.split")}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <IconCut size={15} />
                  {t("trimmer.split")}
                  <kbd className="rounded bg-white/15 px-1 py-0.5 text-[9px]">S</kbd>
                </button>
              </div>
            </div>
              </section>
              {isCaptionPanelOpen && (
                <CaptionInspector
                  captions={captions}
                  languages={subtitleLanguages}
                  models={whisperModels}
                  loading={isLoadingCaptions}
                  error={captionError}
                  currentTime={currentTime}
                  onChange={applyCaptionsChange}
                  onSourceChange={handleCaptionSourceChange}
                  onLanguageChange={handleCaptionLanguageChange}
                  onReload={reloadCaptions}
                  onSeek={seekTo}
                />
              )}
              </div>

            <section className="h-[274px] shrink-0 border-t border-surface-200 bg-surface-50 p-3 dark:border-surface-200">
              <div
                role="toolbar"
                aria-label={t("trimmer.timeline")}
                className="mb-2 flex h-10 items-center justify-between border-y border-surface-200 bg-surface-100/50 px-1 dark:border-surface-300 dark:bg-surface-100/30"
              >
                <div className="flex min-w-0 items-center">
                  <span className="hidden px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-surface-500 sm:block">
                    {t("trimmer.timeline")}
                  </span>
                  <span className="mx-1 h-5 w-px bg-surface-300" aria-hidden="true" />
                  <TimelineToolButton
                    icon={<IconArrowBackUp size={17} />}
                    label={t("trimmer.undo")}
                    shortcut="Ctrl + Z"
                    onClick={undo}
                    disabled={history.length === 0}
                  />
                  <TimelineToolButton
                    icon={<IconArrowForwardUp size={17} />}
                    label={t("trimmer.redo")}
                    shortcut="Ctrl + Shift + Z"
                    onClick={redo}
                    disabled={future.length === 0}
                  />
                  <span className="mx-1 h-5 w-px bg-surface-300" aria-hidden="true" />
                  <TimelineToolButton
                    icon={<IconCut size={17} />}
                    label={t("trimmer.split_at_playhead")}
                    shortcut="S"
                    onClick={splitAtPlayhead}
                    disabled={!canSplit}
                  />
                  <TimelineToolButton
                    icon={<IconTrash size={17} />}
                    label={t("trimmer.delete_clip")}
                    shortcut="Del"
                    onClick={deleteSelectedClip}
                    disabled={!selectedClip || visibleClips.length <= 1}
                  />
                  <span className="mx-1 h-5 w-px bg-surface-300" aria-hidden="true" />
                  <TimelineToolButton
                    icon={<IconPlayerTrackPrev size={17} />}
                    label={t("trimmer.previous_edit")}
                    shortcut="Ctrl + ←"
                    onClick={() => jumpToEdit(-1)}
                  />
                  <TimelineToolButton
                    icon={<IconPlayerTrackNext size={17} />}
                    label={t("trimmer.next_edit")}
                    shortcut="Ctrl + →"
                    onClick={() => jumpToEdit(1)}
                  />
                  <TimelineToolButton
                    icon={<IconReload size={17} />}
                    label={t("trimmer.preview")}
                    shortcut="P"
                    onClick={previewEdit}
                  />
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <span className="hidden pr-2 text-[10px] text-surface-500 lg:block">
                    {t("trimmer.output_duration")} {" "}
                    <strong className="font-mono font-semibold text-surface-700">{formatTime(outputDuration)}</strong>
                  </span>
                  <span className="mx-1 h-5 w-px bg-surface-300" aria-hidden="true" />
                  <TimelineToolButton
                    icon={<IconZoomOut size={16} />}
                    label={t("trimmer.zoom_out")}
                    shortcut="−"
                    onClick={() => setTimelineZoom((zoom) => Math.max(1, zoom - 1))}
                    disabled={timelineZoom <= 1}
                  />
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={timelineZoom}
                    onChange={(event) => setTimelineZoom(Number(event.target.value))}
                    aria-label={t("trimmer.timeline_zoom")}
                    className="h-1 w-20 cursor-pointer accent-primary-500"
                  />
                  <TimelineToolButton
                    icon={<IconZoomIn size={16} />}
                    label={t("trimmer.zoom_in")}
                    shortcut="+"
                    onClick={() => setTimelineZoom((zoom) => Math.min(4, zoom + 1))}
                    disabled={timelineZoom >= 4}
                  />
                  <span className="w-7 text-center font-mono text-[9px] text-surface-500">
                    {timelineZoom}×
                  </span>
                </div>
              </div>

              <div className="mb-1 flex justify-between font-mono text-[10px] text-surface-400">
                <span>0:00</span>
                <span>{formatTime(outputDuration)}</span>
              </div>
              <div
                ref={timelineViewportRef}
                className="overflow-x-auto overflow-y-hidden rounded-xl pb-2 custom-scrollbar"
              >
                <div
                  ref={timelineRef}
                  onPointerDown={(event) => {
                    setIsScrubbing(true);
                    seekFromTimeline(event.clientX);
                  }}
                  style={{ width: `${timelineZoom * 100}%` }}
                  className="relative h-28 min-w-full cursor-ew-resize select-none overflow-visible rounded-xl bg-surface-200 p-1 dark:bg-surface-200"
                >
                  <div className="flex h-[68px]">
                    {visibleClips.map((clip, index) => (
                      <button
                        type="button"
                        key={`${clip.start}-${clip.end}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedClip(clip);
                        }}
                        style={{ flexGrow: clip.end - clip.start, flexBasis: 0 }}
                        className={`relative min-w-8 overflow-hidden border-y border-r first:rounded-l-lg first:border-l last:rounded-r-lg transition-colors ${
                          sameRange(selectedClip, clip)
                            ? "z-10 border-primary-500 bg-primary-500/20 ring-2 ring-primary-500"
                            : activeClip && sameRange(activeClip, clip)
                              ? "border-primary-500/50 bg-primary-500/10"
                              : "border-surface-300 bg-white hover:bg-surface-100 dark:bg-surface-100 dark:hover:bg-surface-300"
                        }`}
                      >
                        <span className="absolute inset-x-2 top-2 truncate text-left text-[10px] font-bold uppercase tracking-wide text-surface-600">
                          {t("trimmer.clip")} {index + 1}
                        </span>
                        <span className="absolute inset-x-2 bottom-2 truncate text-left font-mono text-[10px] text-surface-400">
                          {formatTime(clip.start)}–{formatTime(clip.end)}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="relative mt-1 h-8 overflow-hidden rounded-md border border-violet-300/70 bg-violet-500/10">
                    <span className="pointer-events-none absolute left-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-violet-600/70 dark:text-violet-300">
                      <IconSubtitles size={11} /> {t("trimmer.caption_track")}
                    </span>
                    {captionTrackItems.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        title={item.text}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          seekTo(item.sourceStart);
                          setIsCaptionPanelOpen(true);
                        }}
                        style={{
                          left: `${(item.start / outputDuration) * 100}%`,
                          width: `${Math.max(
                            0.3,
                            ((item.end - item.start) / outputDuration) * 100,
                          )}%`,
                        }}
                        className="absolute inset-y-1 overflow-hidden rounded border border-violet-500/50 bg-violet-500/30 px-1 text-left text-[9px] font-medium text-violet-900 transition-colors hover:bg-violet-500/40 dark:text-violet-100 dark:hover:bg-violet-500/50"
                      >
                        <span className="block truncate">{item.text}</span>
                      </button>
                    ))}
                  </div>

                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-1 -top-2 z-30 w-0.5 bg-primary-500 shadow-[0_0_8px_rgba(255,31,31,0.6)]"
                    style={{ left: `calc(4px + (100% - 8px) * ${playheadPercent / 100})` }}
                  >
                    <span className="absolute -left-[5px] -top-1 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[7px] border-l-transparent border-r-transparent border-t-primary-500" />
                  </div>
                </div>
              </div>

            </section>

            {cutRanges.length > 0 && (
              <div className="fixed bottom-[286px] right-4 z-50 max-w-[min(520px,calc(100vw-2rem))] rounded-xl border border-surface-200 bg-surface-50/95 p-3 shadow-xl backdrop-blur dark:border-surface-300 dark:bg-surface-100/95">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-500">
                  {t("trimmer.removed_sections")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {cutRanges.map((range, index) => (
                    <button
                      key={`${range.start}-${range.end}-${index}`}
                      type="button"
                      onClick={() => restoreRange(index)}
                      className="inline-flex items-center gap-2 rounded-lg bg-surface-200 px-3 py-1.5 font-mono text-xs text-surface-700 transition-colors hover:bg-surface-300"
                      title={t("trimmer.restore_section")}
                    >
                      {formatTime(range.start)}–{formatTime(range.end)}
                      <IconRestore size={14} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

const VideoTrimmer = memo(VideoTrimmerInner);
export default VideoTrimmer;
