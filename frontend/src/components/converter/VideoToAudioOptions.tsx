import { memo } from "react";
import { PillButton } from "./PillButton";
import { SectionHeader } from "./SectionHeader";

interface VideoToAudioOptionsProps {
  audioFormat: string;
  setAudioFormat: (f: string) => void;
  audioQuality: string;
  setAudioQuality: (q: string) => void;
  t: (key: string) => string;
}

/**
 * Opções de extração de áudio de vídeo.
 */
export const VideoToAudioOptions = memo(function VideoToAudioOptions({
  audioFormat,
  setAudioFormat,
  audioQuality,
  setAudioQuality,
  t,
}: VideoToAudioOptionsProps) {
  const formats = [
    { id: "mp3", label: "MP3", desc: t("format_desc.universal") },
    { id: "aac", label: "AAC", desc: t("format_desc.high_quality") },
    { id: "flac", label: "FLAC", desc: t("format_desc.lossless") },
    { id: "wav", label: "WAV", desc: t("format_desc.uncompressed") },
    { id: "ogg", label: "OGG", desc: t("format_desc.opensource") },
    { id: "opus", label: "OPUS", desc: t("format_desc.modern") },
  ];

  const qualities = [
    { id: "low", label: t("quality.low"), bitrate: "128 kbps" },
    { id: "medium", label: t("quality.medium"), bitrate: "192 kbps" },
    { id: "high", label: t("quality.high"), bitrate: "256 kbps" },
    { id: "best", label: t("quality.max"), bitrate: "320 kbps" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <SectionHeader>{t("audio_format")}</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {formats.map((fmt) => (
            <PillButton
              key={fmt.id}
              selected={audioFormat === fmt.id}
              onClick={() => setAudioFormat(fmt.id)}
              subtitle={fmt.desc}
            >
              {fmt.label}
            </PillButton>
          ))}
        </div>
      </div>

      <div>
        <SectionHeader>{t("quality_bitrate")}</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {qualities.map((q) => (
            <PillButton
              key={q.id}
              selected={audioQuality === q.id}
              onClick={() => setAudioQuality(q.id)}
              subtitle={q.bitrate}
            >
              {q.label}
            </PillButton>
          ))}
        </div>
      </div>
    </div>
  );
});
