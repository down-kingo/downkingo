import { memo } from "react";
import { SectionHeader } from "./SectionHeader";

interface CompressImageOptionsProps {
  imageQuality: number;
  setImageQuality: (q: number) => void;
  t: (key: string) => string;
}

/**
 * Opções de compressão de imagem.
 */
export const CompressImageOptions = memo(function CompressImageOptions({
  imageQuality,
  setImageQuality,
  t,
}: CompressImageOptionsProps) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeader>{t("quality")}</SectionHeader>
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
          <span>{t("max_compression")}</span>
          <span>{t("max_quality")}</span>
        </div>
      </div>
    </div>
  );
});
