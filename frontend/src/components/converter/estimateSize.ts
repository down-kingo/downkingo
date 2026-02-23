import type { ConversionTab } from "./types";

/**
 * Estimates the output file size based on input size, conversion type, format, and quality.
 * Returns null if estimation is not possible.
 */
export function estimateOutputSize(
  inputSize: number,
  tab: ConversionTab,
  format: string,
  quality: number | string,
): number | null {
  if (!inputSize || inputSize <= 0) return null;

  switch (tab) {
    case "image-to-image": {
      const q = typeof quality === "number" ? quality : 85;
      switch (format) {
        case "jpg":
        case "jpeg":
          return Math.round(inputSize * (q / 100) * 0.3);
        case "webp":
          return Math.round(inputSize * (q / 100) * 0.2);
        case "avif":
          return Math.round(inputSize * (q / 100) * 0.15);
        case "png":
          return Math.round(inputSize * 0.9);
        case "bmp":
          return Math.round(inputSize * 1.2);
        default:
          return null;
      }
    }

    case "compress-image": {
      const q = typeof quality === "number" ? quality : 85;
      return Math.round(inputSize * (q / 100) * 0.4);
    }

    case "video-to-video": {
      const ratios: Record<string, number> = {
        lossless: 1.0,
        high: 0.7,
        medium: 0.5,
        low: 0.3,
        tiny: 0.15,
      };
      const ratio = ratios[String(quality)] ?? 0.5;
      return Math.round(inputSize * ratio);
    }

    case "compress-video": {
      const ratios: Record<string, number> = {
        lossless: 0.95,
        high: 0.6,
        medium: 0.4,
        low: 0.25,
        tiny: 0.1,
      };
      const ratio = ratios[String(quality)] ?? 0.4;
      return Math.round(inputSize * ratio);
    }

    case "video-to-audio": {
      // Audio is typically ~5-10% of video size
      return Math.round(inputSize * 0.08);
    }

    default:
      return null;
  }
}
