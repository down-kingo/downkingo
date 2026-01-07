import { memo } from "react";
import { PillButton } from "./PillButton";
import { SectionHeader } from "./SectionHeader";

interface CompressVideoOptionsProps {
  videoQuality: string;
  setVideoQuality: (q: string) => void;
  videoPreset: string;
  setVideoPreset: (p: string) => void;
  t: (key: string) => string;
}

/**
 * Opções de compressão de vídeo.
 */
export const CompressVideoOptions = memo(function CompressVideoOptions({
  videoQuality,
  setVideoQuality,
  videoPreset,
  setVideoPreset,
  t,
}: CompressVideoOptionsProps) {
  const compressionLevels = [
    {
      id: "high",
      label: t("compression.light"),
      crf: "18",
      desc: t("format_desc.high_quality"),
    },
    {
      id: "medium",
      label: t("compression.medium"),
      crf: "23",
      desc: t("compression.balanced"),
    },
    {
      id: "low",
      label: t("compression.strong"),
      crf: "28",
      desc: t("compression.smaller_file"),
    },
    {
      id: "tiny",
      label: t("compression.max"),
      crf: "35",
      desc: t("compression.much_smaller"),
    },
  ];

  const presets = [
    { id: "ultrafast", label: t("preset.ultrafast") },
    { id: "fast", label: t("preset.fast") },
    { id: "medium", label: t("preset.medium") },
    { id: "slow", label: t("preset.slow") },
  ];

  return (
    <div className="space-y-4">
      <div>
        <SectionHeader>{t("compression_level")}</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {compressionLevels.map((q) => (
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

      <div>
        <SectionHeader>{t("encoding_speed")}</SectionHeader>
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
    </div>
  );
});
