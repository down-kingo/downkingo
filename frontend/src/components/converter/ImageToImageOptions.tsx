import { memo } from "react";
import { PillButton } from "./PillButton";
import { SectionHeader } from "./SectionHeader";

interface ImageToImageOptionsProps {
  imageFormat: string;
  setImageFormat: (f: string) => void;
  imageQuality: number;
  setImageQuality: (q: number) => void;
  t: (key: string) => string;
}

/**
 * Opções de conversão de imagem para imagem.
 */
export const ImageToImageOptions = memo(function ImageToImageOptions({
  imageFormat,
  setImageFormat,
  imageQuality,
  setImageQuality,
  t,
}: ImageToImageOptionsProps) {
  const formats = [
    { id: "webp", label: "WebP", desc: t("format_desc.modern_smaller") },
    { id: "avif", label: "AVIF", desc: t("format_desc.much_smaller") },
    { id: "jpg", label: "JPEG", desc: t("format_desc.universal") },
    { id: "png", label: "PNG", desc: t("format_desc.lossless") },
    { id: "bmp", label: "BMP", desc: t("format_desc.uncompressed") },
  ];

  return (
    <div className="space-y-4">
      <div>
        <SectionHeader>{t("output_format")}</SectionHeader>
        <div className="flex flex-wrap gap-1.5">
          {formats.map((fmt) => (
            <PillButton
              key={fmt.id}
              selected={imageFormat === fmt.id}
              onClick={() => setImageFormat(fmt.id)}
              subtitle={fmt.desc}
            >
              {fmt.label}
            </PillButton>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader>{t("quality_label")}</SectionHeader>
          <span className="text-xs font-semibold text-surface-900 dark:text-white">
            {imageQuality}%
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="100"
          value={imageQuality}
          onChange={(e) => setImageQuality(Number(e.target.value))}
          className="w-full h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-primary-600"
        />
        <div className="flex justify-between text-[10px] text-surface-400 mt-1">
          <span>{t("smaller_file")}</span>
          <span>{t("better_quality")}</span>
        </div>
      </div>
    </div>
  );
});
