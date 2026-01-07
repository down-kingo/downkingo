import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconChevronDown } from "@tabler/icons-react";
import { PillButton } from "./PillButton";
import { SectionHeader } from "./SectionHeader";

interface VideoToVideoOptionsProps {
  videoFormat: string;
  setVideoFormat: (f: string) => void;
  videoQuality: string;
  setVideoQuality: (q: string) => void;
  videoPreset: string;
  setVideoPreset: (p: string) => void;
  keepAudio: boolean;
  setKeepAudio: (v: boolean) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  t: (key: string) => string;
}

/**
 * Opções de conversão de vídeo para vídeo.
 */
export const VideoToVideoOptions = memo(function VideoToVideoOptions({
  videoFormat,
  setVideoFormat,
  videoQuality,
  setVideoQuality,
  videoPreset,
  setVideoPreset,
  keepAudio,
  setKeepAudio,
  showAdvanced,
  setShowAdvanced,
  t,
}: VideoToVideoOptionsProps) {
  const formats = ["mp4", "mkv", "webm", "avi", "mov"];

  const qualities = [
    { id: "lossless", label: t("quality.lossless"), crf: "0" },
    { id: "high", label: t("quality.high"), crf: "18" },
    { id: "medium", label: t("quality.medium"), crf: "23" },
    { id: "low", label: t("quality.low"), crf: "28" },
    { id: "tiny", label: t("quality.tiny"), crf: "35" },
  ];

  const presets = [
    { id: "ultrafast", label: t("preset.ultrafast") },
    { id: "fast", label: t("preset.fast") },
    { id: "medium", label: t("preset.medium") },
    { id: "slow", label: t("preset.slow") },
    { id: "veryslow", label: t("preset.veryslow") },
  ];

  return (
    <div className="space-y-4">
      <div>
        <SectionHeader>{t("output_format")}</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {formats.map((fmt) => (
            <PillButton
              key={fmt}
              selected={videoFormat === fmt}
              onClick={() => setVideoFormat(fmt)}
            >
              {fmt.toUpperCase()}
            </PillButton>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader>{t("quality_crf")}</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {qualities.map((q) => (
            <PillButton
              key={q.id}
              selected={videoQuality === q.id}
              onClick={() => setVideoQuality(q.id)}
              subtitle={`CRF ${q.crf}`}
            >
              {q.label}
            </PillButton>
          ))}
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <div className="pt-2 border-t border-surface-100 dark:border-white/10">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-xs font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors py-2"
        >
          <IconChevronDown
            size={16}
            className={`transition-transform ${
              showAdvanced ? "rotate-180" : ""
            }`}
          />
          {t("more_options")}
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-3">
                <div>
                  <SectionHeader>{t("encoding_preset")}</SectionHeader>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((p) => (
                      <PillButton
                        key={p.id}
                        selected={videoPreset === p.id}
                        onClick={() => setVideoPreset(p.id)}
                      >
                        {p.label}
                      </PillButton>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-800/50 rounded-xl">
                  <input
                    type="checkbox"
                    id="keepAudio"
                    checked={keepAudio}
                    onChange={(e) => setKeepAudio(e.target.checked)}
                    className="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label
                    htmlFor="keepAudio"
                    className="text-xs font-medium text-surface-700 dark:text-surface-300"
                  >
                    {t("keep_audio_track")}
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
